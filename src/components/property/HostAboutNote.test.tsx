/**
 * TASK-5181 — pins the two states of the guest-facing host-note panel: a real, non-empty
 * `hostAbout` renders the host's own words (signed only when a real host name is on file); an
 * absent/empty field renders NOTHING — no fallback string, no default copy, no attribution.
 *
 * Prior defect: both PropertyDetails layouts rendered a hardcoded first-person quote for EVERY
 * listing, signed "— {hostName}, your host" whenever a real host name was on file — words no host
 * ever wrote, attributed to a real person. A later fix swapped in `data.hostAbout` when present
 * but kept a synthetic fallback sentence ("Your host has not added a personal note for this
 * listing yet."), so the panel still rendered unconditionally. This component/test removes that
 * fallback entirely.
 *
 * This is a full-render, real-DOM test (not a source-content scan). HostAboutNote has zero heavy
 * dependencies (no react-icons/lucide-react/lazy chunks), so it's safe to render fully — unlike
 * the parent PropertyDetails pages, which vitest.config.ts documents exhaust the Windows worker
 * heap when rendered whole (`heavyRouteSmokes`).
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import HostAboutNote from './HostAboutNote';

describe('HostAboutNote — TASK-5181 no-fabrication gate', () => {
  it('renders the host\'s real words and signs them when a real host name is on file', () => {
    render(
      <HostAboutNote
        hostAbout="We repaint the walls every season and keep a spare charger at the desk."
        hasRealHost
        hostDisplayName="Meera Iyer"
        heading="A note from your host"
        ariaLabel="A note from your host"
      />,
    );

    expect(
      screen.getByText('We repaint the walls every season and keep a spare charger at the desk.'),
    ).toBeInTheDocument();
    expect(screen.getByText('— Meera Iyer, your host')).toBeInTheDocument();
    expect(screen.getByRole('note', { name: 'A note from your host' })).toBeInTheDocument();
  });

  it('renders the note but withholds attribution when there is no real host name on file', () => {
    render(
      <HostAboutNote
        hostAbout="Feel free to message any time."
        hasRealHost={false}
        hostDisplayName="Listed by Atlas Homestays"
        heading="A note from your host"
        ariaLabel="A note from your host"
      />,
    );

    expect(screen.getByText('Feel free to message any time.')).toBeInTheDocument();
    // No "— <name>, your host" signature anywhere — never sign fallback/brand text as a person.
    expect(screen.queryByText(/^—.*your host$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Listed by Atlas Homestays, your host/)).not.toBeInTheDocument();
  });

  it('renders NOTHING when hostAbout is absent — no fallback string, no panel, no attribution', () => {
    const { container } = render(
      <HostAboutNote
        hostAbout={null}
        hasRealHost
        hostDisplayName="Meera Iyer"
        heading="A note from your host"
        ariaLabel="A note from your host"
      />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    expect(screen.queryByText(/your host has not added/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Meera Iyer/)).not.toBeInTheDocument();
  });

  it('renders NOTHING when hostAbout is undefined', () => {
    const { container } = render(
      <HostAboutNote
        hasRealHost
        hostDisplayName="Meera Iyer"
        heading="A note from your host"
        ariaLabel="A note from your host"
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders NOTHING when hostAbout is whitespace-only', () => {
    const { container } = render(
      <HostAboutNote
        hostAbout="   "
        hasRealHost
        hostDisplayName="Meera Iyer"
        heading="A note from your host"
        ariaLabel="A note from your host"
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
