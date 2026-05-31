import StateMessage from "../../components/StateMessage";

const PageNotFound = () => {
  return (
    <StateMessage
      data-testid="page-not-found"
      icon="🧭"
      title="We couldn't find that page"
      message="The page you’re looking for doesn’t exist or has moved. Let’s get you back to browsing homes."
      primaryAction={{ label: "Back to homepage", to: "/" }}
    />
  );
};

export default PageNotFound;
