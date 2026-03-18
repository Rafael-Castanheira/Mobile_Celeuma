import { Feather } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { useAppTheme } from "../context/ThemeContext";
import { loginUser } from "../lib/360api";
import { getAuthenticatedHomeRoute, isAdminRole } from "../lib/auth";

export default function Login() {
  const router = useRouter();
  const { top, bottom } = useSafeAreaInsets();
  const { setAuth } = useAuth();
  const { colors } = useAppTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError("Preencha o e-mail e a senha.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { token, user } = await loginUser(email.trim(), password);
      setAuth(user, token);
      router.replace(
        (isAdminRole(user.role) ? "/admin" : getAuthenticatedHomeRoute(user.role)) as Href
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: top, paddingBottom: bottom + 16, backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Cabeçalho */}
      <View style={styles.header}>
        <View style={[styles.logoCircle, { backgroundColor: colors.surfaceAlt, borderColor: colors.primaryStrong, shadowColor: colors.shadow }]}> 
          <Feather name="aperture" size={40} color={colors.primary} />
        </View>
        <Text style={[styles.appName, { color: colors.text }]}>Galerias 360</Text>
        <Text style={[styles.tagline, { color: colors.textMuted }]}>Explore o mundo em todas as direções</Text>
      </View>

      {/* Formulário */}
      <View style={styles.form}>
        <Text style={[styles.formTitle, { color: colors.text }]}>Entrar na conta</Text>

        {/* Mensagem de erro */}
        {error && (
          <View style={[styles.errorBox, { backgroundColor: colors.dangerSoft, borderColor: colors.danger }]}> 
            <Feather name="alert-circle" size={15} color={colors.danger} style={{ marginRight: 8 }} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Campo e-mail */}
        <View style={[styles.inputWrapper, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}> 
          <Feather name="mail" size={18} color={colors.textMuted} style={styles.inputIcon} />
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="E-mail"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            returnKeyType="next"
          />
        </View>

        {/* Campo senha */}
        <View style={[styles.inputWrapper, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}> 
          <Feather name="lock" size={18} color={colors.textMuted} style={styles.inputIcon} />
          <TextInput
            style={[styles.input, { flex: 1, color: colors.text }]}
            placeholder="Senha"
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoComplete="password"
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />
          <Pressable onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
            <Feather
              name={showPassword ? "eye-off" : "eye"}
              size={18}
              color={colors.textMuted}
            />
          </Pressable>
        </View>

        {/* Esqueci a senha */}
        <Pressable style={styles.forgotWrapper}>
          <Text style={[styles.forgotText, { color: colors.primary }]}>Esqueceu a senha?</Text>
        </Pressable>

        {/* Botão entrar */}
        <Pressable
          style={({ pressed }) => [
            styles.loginBtn,
            { backgroundColor: colors.primary, shadowColor: colors.shadow },
            pressed && styles.loginBtnPressed,
            loading && styles.loginBtnDisabled,
          ]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.textOnPrimary} />
          ) : (
            <Text style={[styles.loginBtnText, { color: colors.textOnPrimary }]}>Entrar</Text>
          )}
        </Pressable>
      </View>

      {/* Rodapé */}
      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.textMuted }]}>Não tem uma conta? </Text>
        <Pressable>
          <Text style={[styles.footerLink, { color: colors.primary }]}>Cadastre-se</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0d0000",
    paddingHorizontal: 28,
    justifyContent: "space-between",
  },
  /* Cabeçalho */
  header: {
    alignItems: "center",
    marginTop: 24,
  },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#1e0000",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#7a1313",
    shadowColor: "#dc2626",
    shadowOpacity: 0.6,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    marginBottom: 16,
  },
  appName: {
    color: "#f8fafc",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  tagline: {
    color: "rgba(248,250,252,0.5)",
    fontSize: 14,
    textAlign: "center",
  },
  /* Formulário */
  form: {
    gap: 14,
  },
  formTitle: {
    color: "#f8fafc",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 4,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e0000",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#3d0000",
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: "#f8fafc",
    fontSize: 15,
  },
  eyeBtn: {
    paddingLeft: 8,
  },
  forgotWrapper: {
    alignSelf: "flex-end",
  },
  forgotText: {
    color: "#dc2626",
    fontSize: 13,
    fontWeight: "600",
  },
  loginBtn: {
    backgroundColor: "#dc2626",
    borderRadius: 14,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    shadowColor: "#dc2626",
    shadowOpacity: 0.55,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  loginBtnPressed: {
    opacity: 0.8,
  },
  loginBtnDisabled: {
    opacity: 0.6,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(220,38,38,0.15)",
    borderWidth: 1,
    borderColor: "rgba(220,38,38,0.4)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    color: "#fca5a5",
    fontSize: 13,
    flex: 1,
  },
  loginBtnText: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  /* Rodapé */
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  footerText: {
    color: "rgba(248,250,252,0.5)",
    fontSize: 14,
  },
  footerLink: {
    color: "#dc2626",
    fontSize: 14,
    fontWeight: "700",
  },
});
