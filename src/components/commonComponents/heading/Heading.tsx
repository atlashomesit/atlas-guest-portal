import "./heading.css";

interface HeadingProps {
  title: string;
  id?: string;
}

const Heading = ({ title, id }: HeadingProps) => {
  return (
    <section className="section-heading" aria-label={title} id={id}>
      <h2 className="section-heading__title">{title}</h2>
      <div className="section-heading__underline" aria-hidden="true" />
    </section>
  );
};

export default Heading;
