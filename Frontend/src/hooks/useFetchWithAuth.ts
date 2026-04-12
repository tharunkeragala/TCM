import { useEffect, useState } from "react";
import API from "../services/api";

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export default function useFetchWithAuth<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    fetchData();
  }, [url]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");

      const token =
        localStorage.getItem("token") ||
        sessionStorage.getItem("token");

      if (!token) {
        setError("User not authenticated");
        setLoading(false);
        return;
      }

      const res = await API.get<ApiResponse<T>>(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // ✅ Handle both formats safely
      const responseData: any = res.data.data;

      if (Array.isArray(responseData)) {
        setData(responseData as T);
      } else if (responseData?.data) {
        setData(responseData.data as T);
      } else {
        setData(responseData as T);
      }

    } catch (err: any) {
      console.error(`Error fetching ${url}:`, err);

      if (err.response?.status === 403) {
        setError("Access denied.");
      } else if (err.response?.status === 401) {
        setError("Unauthorized. Please login again.");
      } else {
        setError("Failed to load data.");
      }
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, refetch: fetchData };
}