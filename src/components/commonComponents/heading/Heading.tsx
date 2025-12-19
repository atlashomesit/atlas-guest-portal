import "./heading.css";

interface HeadingProps {
  title: string;
}

const Heading = ({ title }: HeadingProps) => {
  return (
    <section className="section-heading" aria-label={title}>
      <h2 className="section-heading__title">{title}</h2>
      <div className="section-heading__underline" aria-hidden="true" />
    </section>
  );
};

export default Heading;
