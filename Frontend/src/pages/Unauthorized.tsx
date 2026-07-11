import GridShape from "../components/common/GridShape";
import { Link, useLocation, useNavigate } from "react-router";
import PageMeta from "../components/common/PageMeta";

interface UnauthorizedState {
  noAccessAtAll?: boolean;
  attemptedPath?: string;
}

export default function Unauthorized() {
  const navigate = useNavigate();
  const location = useLocation();

  const state = (location.state as UnauthorizedState) || {};
  const noAccessAtAll = Boolean(state.noAccessAtAll);

  const handleSignOut = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    navigate("/signin", { replace: true });
  };

  return (
    <>
      <PageMeta
        title="403 Unauthorized | TCM"
        description="Unauthorized access page"
      />

      <div className="relative flex flex-col items-center justify-center min-h-screen p-6 overflow-hidden z-1">
        <GridShape />

        <div className="mx-auto w-full max-w-[242px] text-center sm:max-w-[472px]">
          <h1 className="mb-8 font-bold text-red-500 text-title-md xl:text-title-2xl">
            403
          </h1>

          <p className="mt-10 mb-6 text-base text-gray-700 dark:text-gray-400 sm:text-lg">
            {noAccessAtAll
              ? "Your account doesn't have permissions assigned yet. Please contact administrator."
              : "You don't have permission to access this page."}
          </p>

          {/* Buttons */}
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            {noAccessAtAll ? (
              // Case 1: no access to anything — only sane option is sign out
              <button
                onClick={handleSignOut}
                className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-5 py-3.5 text-sm font-medium text-white hover:bg-brand-600"
              >
                Sign Out
              </button>
            ) : (
              // Case 2: has access elsewhere, just not this route
              <>
                <button
                  onClick={() => navigate(-1)}
                  className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-3.5 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200"
                >
                  Go Back
                </button>

                <Link
                  to="/home"
                  className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-5 py-3.5 text-sm font-medium text-white hover:bg-brand-600"
                >
                  Home
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="absolute text-sm text-center text-gray-500 -translate-x-1/2 bottom-6 left-1/2 dark:text-gray-400">
          &copy; {new Date().getFullYear()} - TCM
        </p>
      </div>
    </>
  );
}