import { Redirect } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import { getAuthenticatedHomeRoute } from "../../lib/auth";

export default function Inicio() {
  const { user } = useAuth();

  return <Redirect href={getAuthenticatedHomeRoute(user?.role)} />;
}
