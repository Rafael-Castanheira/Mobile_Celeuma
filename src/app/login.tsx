import { Feather } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import { useEffect, useState } from "react";
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
import BrandLogo from "../components/BrandLogo";
import { useAuth } from "../context/AuthContext";
import { useAppTheme } from "../context/ThemeContext";
import { getLandingContent, loginUser, type LandingContent } from "../lib/360api";
import { getAuthenticatedHomeRoute, isAdminRole } from "../lib/auth";

export default function Login() {
  const router = useRouter();
  const { top, bottom } = useSafeAreaInsets();
  const { setAuth } = useAuth();
  const { colors, activePreset } = useAppTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [landing, setLanding] = useState<LandingContent | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadLanding() {
      try {
        setLanding(await getLandingContent(controller.signal));
      } catch {
        setLanding(null);
      }
    }

    loadLanding();
    return () => controller.abort();
  }, []);

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
      style={[styles.root, { backgroundColor: colors.background, paddingTop: top, paddingBottom: bottom + 16 }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Cabeçalho */}
      <View style={styles.header}>
        <BrandLogo size={88} iconSize={40} withFrame />
        <Text style={[styles.appName, { color: colors.foreground }]}>Galerias 360</Text>
        <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
          {landing?.title ?? activePreset?.description ?? "Explore o mundo em todas as direções"}
        </Text>
        <Text style={[styles.heroDescription, { color: colors.mutedForeground }]}>
          {landing?.description ?? "Descobre pontos turísticos e culturais com uma experiência imersiva em 360º."}
        </Text>
      </View>

      {/* Formulário */}
      <View style={styles.form}>
        <Text style={[styles.formTitle, { color: colors.foreground }]}>Entrar na conta</Text>

        {/* Mensagem de erro */}
        {error && (
          <View style={[styles.errorBox, { backgroundColor: colors.accentSoft, borderColor: colors.destructive }]}> 
            <Feather name="alert-circle" size={15} color={colors.destructive} style={{ marginRight: 8 }} />
            <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
          </View>
        )}

        {/* Campo e-mail */}
        <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="mail" size={18} color={colors.iconMuted} style={styles.inputIcon} />
          <TextInput
            style={[styles.input, { color: colors.foreground }]}
            placeholder="E-mail"
            placeholderTextColor={colors.placeholder}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            returnKeyType="next"
          />
        </View>

        {/* Campo senha */}
        <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="lock" size={18} color={colors.iconMuted} style={styles.inputIcon} />
          <TextInput
            style={[styles.input, { flex: 1, color: colors.foreground }]}
            placeholder="Senha"
            placeholderTextColor={colors.placeholder}
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
              color={colors.iconMuted}
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
            { backgroundColor: loading ? colors.buttonDisabled : colors.primary, shadowColor: colors.shadow },
            pressed && styles.loginBtnPressed,
            loading && styles.loginBtnDisabled,
          ]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.loginBtnText, { color: colors.primaryForeground }]}>Entrar</Text>
          )}
        </Pressable>
      </View>

      {/* Rodapé */}
      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.mutedForeground }]}>Não tem uma conta? </Text>
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
  appName: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  tagline: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 10,
  },
  heroDescription: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 320,
  },
  /* Formulário */
  form: {
    gap: 14,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 4,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
  },
  eyeBtn: {
    paddingLeft: 8,
  },
  forgotWrapper: {
    alignSelf: "flex-end",
  },
  forgotText: {
    fontSize: 13,
    fontWeight: "600",
  },
  loginBtn: {
    borderRadius: 14,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
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
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    fontSize: 13,
    flex: 1,
  },
  loginBtnText: {
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
    fontSize: 14,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: "700",
  },
});
