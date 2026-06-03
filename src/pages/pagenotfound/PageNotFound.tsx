import SEO from "../../components/SEO";
import StateMessage from "../../components/StateMessage";
import { getTenantBrandName } from "../../tenant/displayBrand";

const PageNotFound = () => {
  const brandName = getTenantBrandName();
  return (
    <>
      <SEO
        title={`Page not found | ${brandName}`}
        description={`The page you requested is not available on ${brandName}. Return to the homepage to browse stays.`}
      />
      <StateMessage
        data-testid="page-not-found"
        icon="🧭"
        title="We couldn't find that page"
        message={`The page you’re looking for doesn’t exist or has moved. Let’s get you back to browsing homes on ${brandName}.`}
        primaryAction={{ label: "Back to homepage", to: "/" }}
      />
    </>
  );
};

export default PageNotFound;
