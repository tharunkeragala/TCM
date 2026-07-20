import { Link } from "react-router";
import { Home } from "lucide-react";

interface BreadcrumbProps {
  pageTitle: string;
}

const PageBreadcrumb: React.FC<BreadcrumbProps> = ({ pageTitle }) => {
  return (
    <div className="mb-6">
      <nav>
        <ol className="flex items-center gap-2">
          <li>
            <Link
              to="/home"
              className="inline-flex items-center justify-center h-8 w-8 rounded-md bg-blue-600 text-white shadow-sm hover:bg-blue-700 transition-colors"
            >
              <Home size={16} />
            </Link>
          </li>

          <li>
            <svg
              className="text-gray-400 dark:text-white"
              width="17"
              height="16"
              viewBox="0 0 17 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M6.0765 12.667L10.2432 8.50033L6.0765 4.33366"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </li>

          <li className="text-xl font-semibold text-gray-800 dark:text-white">
            {pageTitle}
          </li>
        </ol>
      </nav>
    </div>
  );
};

export default PageBreadcrumb;