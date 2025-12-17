import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "./Button";
import { Input } from "./Input";
import { Card } from "./Card";
import { Typography } from "./Typography";

describe("UI components", () => {
  it("renders button variants", () => {
    render(
      <div>
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
      </div>
    );

    expect(screen.getByText("Primary")).toHaveClass("rb-button");
    expect(screen.getByText("Secondary")).toHaveClass("rb-button--secondary");
  });

  it("supports textarea and select inputs", () => {
    render(
      <div>
        <Input as="textarea" name="notes" aria-label="Notes" />
        <Input as="select" name="destination" aria-label="Destination">
          <option>Option</option>
        </Input>
      </div>
    );

    expect(screen.getByLabelText("Notes").tagName.toLowerCase()).toBe("textarea");
    expect(screen.getByLabelText("Destination").tagName.toLowerCase()).toBe("select");
  });

  it("wraps content in card and typography", () => {
    render(
      <Card>
        <Typography variant="h3">Inside card</Typography>
      </Card>
    );

    expect(screen.getByText("Inside card")).toBeInTheDocument();
    expect(screen.getByText("Inside card")).toHaveClass("rb-typography--h3");
  });
});
