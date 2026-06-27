import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
    Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BrandLogo from "../components/BrandLogo";
import { useAppTheme } from "../context/ThemeContext";
import { registerUser } from "../lib/360api";

export default function Register() {
  const router = useRouter();
  const { top, bottom } = useSafeAreaInsets();
  const { colors } = useAppTheme();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rgpdAccepted, setRgpdAccepted] = useState(false);
  const [rgpdModalVisible, setRgpdModalVisible] = useState(false);
  const [rgpdHasBeenRead, setRgpdHasBeenRead] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleScroll = (event) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 50;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom) {
      setRgpdHasBeenRead(true);
    }
  };
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  async function handleRegister() {
    const cleanName = name.trim();
    const cleanEmail = email.trim();

    if (!cleanName || !cleanEmail || !password || !confirmPassword) {
      setSuccess(null);
      setError("Por favor, preencha todos os campos.");
      return;
    }

    if (!rgpdAccepted) {
      setSuccess(null);
      setError("É necessário ler e aceitar o RGPD para criar conta.");
      return;
    }

    if (password !== confirmPassword) {
      setSuccess(null);
      setError("As palavras-passe não coincidem.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const message = await registerUser(cleanName, cleanEmail, password);
      setSuccess(message);
      setName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setSuccess(null);
      setError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.muted, paddingTop: top, paddingBottom: bottom + 12 }]}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={styles.header}>
              <BrandLogo size={68} iconSize={30} withFrame />
              <Text style={[styles.formTitle, { color: colors.foreground }]}>Criar conta</Text>
              <Text style={[styles.heroDescription, { color: colors.mutedForeground }]}> 
                Preencha os dados para criar a conta. Depois confirme o e-mail para entrar.
              </Text>
            </View>

          <View style={styles.form}>
            {error && (
              <View style={[styles.errorBox, { backgroundColor: colors.accentSoft, borderColor: colors.destructive }]}> 
                <Feather name="alert-circle" size={15} color={colors.destructive} style={{ marginRight: 8 }} />
                <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
              </View>
            )}

            {success && (
              <View style={[styles.successBox, { backgroundColor: colors.accentSoft, borderColor: colors.primary }]}> 
                <Feather name="check-circle" size={15} color={colors.primary} style={{ marginRight: 8 }} />
                <Text style={[styles.errorText, { color: colors.foreground }]}>{success}</Text>
              </View>
            )}

            <View style={styles.inputBlock}>
              <Text style={[styles.label, { color: colors.foreground }]}>Nome</Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}> 
                <Feather name="user" size={18} color={colors.iconMuted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder="Nome"
                  placeholderTextColor={colors.placeholder}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>
            </View>

            <View style={styles.inputBlock}>
              <Text style={[styles.label, { color: colors.foreground }]}>Email</Text>
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
            </View>

            <View style={styles.inputBlock}>
              <Text style={[styles.label, { color: colors.foreground }]}>Senha</Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}> 
                <Feather name="lock" size={18} color={colors.iconMuted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { flex: 1, color: colors.foreground }]}
                  placeholder="Senha"
                  placeholderTextColor={colors.placeholder}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoComplete="password-new"
                  returnKeyType="next"
                />
                <Pressable onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
                  <Feather name={showPassword ? "eye-off" : "eye"} size={18} color={colors.iconMuted} />
                </Pressable>
              </View>
            </View>

            <View style={styles.inputBlock}>
              <Text style={[styles.label, { color: colors.foreground }]}>Confirmar senha</Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}> 
                <Feather name="lock" size={18} color={colors.iconMuted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { flex: 1, color: colors.foreground }]}
                  placeholder="Confirmar senha"
                  placeholderTextColor={colors.placeholder}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  autoComplete="password-new"
                  returnKeyType="done"
                  onSubmitEditing={handleRegister}
                />
                <Pressable onPress={() => setShowConfirmPassword((v) => !v)} style={styles.eyeBtn}>
                  <Feather name={showConfirmPassword ? "eye-off" : "eye"} size={18} color={colors.iconMuted} />
                </Pressable>
              </View>
            </View>

            <View style={styles.checkboxContainer}>
              <Pressable 
                onPress={() => {
                  if (!rgpdHasBeenRead) {
                    setRgpdModalVisible(true);
                  } else {
                    setRgpdAccepted(!rgpdAccepted);
                  }
                }}
              >
                <Feather 
                  name={rgpdAccepted ? "check-square" : "square"} 
                  size={20} 
                  color={rgpdAccepted ? colors.primary : colors.iconMuted} 
                />
              </Pressable>
              <Pressable 
                style={{ flex: 1, marginLeft: 8 }}
                onPress={() => setRgpdModalVisible(true)}
              >
                <Text style={[styles.checkboxLabel, { color: colors.foreground }]}>
                  Confirmo que li e aceito o <Text style={{ color: colors.primary, fontWeight: "bold" }}>RGPD</Text>.
                </Text>
              </Pressable>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.registerBtn,
                { backgroundColor: loading ? colors.buttonDisabled : colors.primary, shadowColor: colors.shadow },
                pressed && styles.registerBtnPressed,
                loading && styles.registerBtnDisabled,
              ]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <Text style={[styles.registerBtnText, { color: colors.primaryForeground }]}>Aguarde...</Text>
              ) : (
                <Text style={[styles.registerBtnText, { color: colors.primaryForeground }]}>Criar Conta</Text>
              )}
            </Pressable>
          </View>

            <View style={styles.footer}>
              <Text style={[styles.footerText, { color: colors.mutedForeground }]}>Já tem conta? </Text>
              <Pressable onPress={() => router.replace("/login")}>
                <Text style={[styles.footerLink, { color: colors.primary }]}>Iniciar sessão</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={rgpdModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setRgpdModalVisible(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>Política de Privacidade e RGPD</Text>
          <ScrollView 
            style={styles.modalScroll}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            <Text style={[styles.modalText, { color: colors.foreground }]}>
              1. Recolha de Dados{'\n'}
              A nossa aplicação recolhe dados pessoais como o nome e o e-mail com o objetivo de criar e gerir a sua conta.{'\n\n'}
              2. Uso dos Dados{'\n'}
              Os dados recolhidos serão utilizados exclusivamente para autenticação e comunicação relacionada com a aplicação.{'\n\n'}
              3. Partilha de Dados{'\n'}
              Não partilhamos os seus dados com terceiros sem o seu consentimento explícito, exceto quando exigido por lei.{'\n\n'}
              4. Direitos do Utilizador{'\n'}
              Tem o direito de aceder, retificar ou apagar os seus dados a qualquer momento.{'\n\n'}
              5. Segurança{'\n'}
              Implementamos medidas de segurança para proteger as suas informações pessoais contra acessos não autorizados.{'\n\n'}
              6. Consentimento{'\n'}
              Ao aceitar, concorda com a recolha e processamento dos seus dados conforme descrito nesta política.{'\n\n'}
              7. Alterações à Política{'\n'}
              Reservamo-nos o direito de alterar esta política. Será notificado de quaisquer alterações significativas.{'\n\n'}
              (Por favor, faça scroll até ao fim para poder aceitar)
              {'\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n'}
              [Fim do documento]
            </Text>
          </ScrollView>
          <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
            <Pressable 
              style={[styles.modalBtn, !rgpdHasBeenRead && styles.modalBtnDisabled, { backgroundColor: rgpdHasBeenRead ? colors.primary : colors.buttonDisabled }]}
              disabled={!rgpdHasBeenRead}
              onPress={() => {
                setRgpdAccepted(true);
                setRgpdModalVisible(false);
              }}
            >
              <Text style={[styles.modalBtnText, { color: colors.primaryForeground }]}>
                {rgpdHasBeenRead ? "Aceitar e Fechar" : "Leia até ao fim para aceitar"}
              </Text>
            </Pressable>
            <Pressable 
              style={styles.modalBtnCancel}
              onPress={() => setRgpdModalVisible(false)}
            >
              <Text style={[styles.modalBtnCancelText, { color: colors.mutedForeground }]}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 16,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  card: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  header: {
    alignItems: "center",
    marginBottom: 14,
  },
  heroDescription: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 6,
  },
  form: {
    gap: 10,
  },
  formTitle: {
    fontSize: 28,
    fontWeight: "700",
    marginTop: 12,
  },
  inputBlock: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 48,
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
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    marginBottom: 8,
  },
  checkboxLabel: {
    fontSize: 14,
  },
  modalContainer: {
    flex: 1,
    paddingTop: Platform.OS === "ios" ? 50 : 20,
    paddingHorizontal: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  modalScroll: {
    flex: 1,
    marginBottom: 20,
  },
  modalText: {
    fontSize: 15,
    lineHeight: 24,
  },
  modalFooter: {
    borderTopWidth: 1,
    paddingVertical: 16,
    paddingBottom: Platform.OS === "ios" ? 34 : 16,
  },
  modalBtn: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 12,
  },
  modalBtnDisabled: {
    opacity: 0.6,
  },
  modalBtnText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  modalBtnCancel: {
    alignItems: "center",
    paddingVertical: 8,
  },
  modalBtnCancelText: {
    fontSize: 15,
    fontWeight: "600",
  },
  registerBtn: {
    borderRadius: 10,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    shadowOpacity: 0.24,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  registerBtnPressed: {
    opacity: 0.8,
  },
  registerBtnDisabled: {
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
  successBox: {
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
  registerBtnText: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },
  footerText: {
    fontSize: 14,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: "700",
  },
});
