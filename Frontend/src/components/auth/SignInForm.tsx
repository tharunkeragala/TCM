import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import API from "../../services/api";
import { EyeCloseIcon, EyeIcon } from "../../icons";
import Label from "../form/Label";
import Input from "../form/input/InputField";
import Checkbox from "../form/input/Checkbox";
import Button from "../ui/button/Button";
import Alert from "../ui/alert/Alert";

export default function SignInForm() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);

  const [alert, setAlert] = useState<{
    variant: "success" | "error" | "warning" | "info";
    title: string;
    message: string;
  } | null>(null);

  // Redirect logged-in users away from login page
  useEffect(() => {
    const token =
      localStorage.getItem("token") ||
      sessionStorage.getItem("token");

    if (token) {
      navigate("/home", { replace: true });
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setAlert(null);

      const res = await API.post("/api/auth/login", {
        username: email,
        password,
      });

      if (remember) {
        localStorage.setItem("token", res.data.token);
      } else {
        sessionStorage.setItem("token", res.data.token);
      }

      setAlert({
        variant: "success",
        title: "Login Successful",
        message: "Redirecting to dashboard...",
      });

      setTimeout(() => {
        navigate("/home", { replace: true });
      }, 1000);
    } catch {
      setAlert({
        variant: "error",
        title: "Login Failed",
        message: "Invalid email or password.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Optional Windows login
  const handleWindowsLogin = async () => {
    try {
      const windowsUser = window.navigator.userAgent;

      const res = await API.post("/api/auth/windows-login", {
        windows_username: windowsUser,
      });

      localStorage.setItem("token", res.data.token);
      navigate("/home", { replace: true });
    } catch {
      setAlert({
        variant: "error",
        title: "Windows Login Failed",
        message: "Unable to authenticate with Windows.",
      });
    }
  };

  return (
    <div className="flex flex-col flex-1">
      <div className="w-full max-w-md pt-10 mx-auto"></div>
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div className="mb-5">
          <h1 className="mb-2 font-semibold text-gray-400 text-title-sm">
            Sign In
          </h1>
          <p className="text-sm text-gray-500">
            Enter your email and password to sign in!
          </p>
        </div>

        {alert && (
          <div className="mb-4">
            <Alert
              variant={alert.variant}
              title={alert.title}
              message={alert.message}
            />
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="space-y-6">
            <div>
              <Label>Email</Label>
              <Input
                placeholder="info@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <Label>Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <span
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute cursor-pointer right-4 top-1/2 -translate-y-1/2"
                >
                  {showPassword ? <EyeIcon className="size-5" /> : <EyeCloseIcon className="size-5" />}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Checkbox checked={remember} onChange={setRemember} />
                <span className="text-sm text-gray-700">Keep me logged in</span>
              </div>
              <Link to="/reset-password" className="text-sm text-brand-500">
                Forgot password?
              </Link>
            </div>

            <Button className="w-full" size="sm" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </div>
        </form>

        <button
          onClick={handleWindowsLogin}
          className="inline-flex items-center justify-center gap-3 py-3 mb-4 text-sm font-normal text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 mt-5"
        >
          Login with Windows
        </button>

        <div className="mt-5 text-center">
          <p className="text-sm text-gray-700">
            Don’t have an account?{" "}
            <Link to="/signup" className="text-brand-500">Sign Up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}