import { Link } from "react-router-dom";

const PageNotFound = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="text-9xl font-extrabold tracking-tight text-gray-300">404</p>
      <h1 className="mt-4 text-2xl font-semibold text-gray-800">
        Page not found
      </h1>
      <p className="mt-2 max-w-md text-gray-500">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        to="/"
        className="mt-8 inline-block rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        Back to Home
      </Link>
    </div>
  );
};

export default PageNotFound;
