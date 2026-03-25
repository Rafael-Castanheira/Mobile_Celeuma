import { createContext, useCallback, useContext, useMemo, useState } from "react";
import AppDialog from "../components/AppDialog";

const DialogContext = createContext(null);

export function DialogProvider({ children }) {
	const [dialog, setDialog] = useState(null);

	const hideDialog = useCallback(() => setDialog(null), []);

	const showDialog = useCallback((options) => {
		setDialog(options);
	}, []);

	const showError = useCallback(
		(message, title = "Erro") => {
			showDialog({ variant: "error", title, message, buttons: [{ text: "OK", variant: "primary" }] });
		},
		[showDialog]
	);

	const showInfo = useCallback(
		(message, title = "Aviso") => {
			showDialog({ variant: "info", title, message, buttons: [{ text: "OK", variant: "primary" }] });
		},
		[showDialog]
	);

	const showSuccess = useCallback(
		(message, title = "Sucesso") => {
			showDialog({ variant: "success", title, message, buttons: [{ text: "OK", variant: "primary" }] });
		},
		[showDialog]
	);

	const showConfirm = useCallback(
		(options) => {
			const {
				title,
				message,
				confirmText = "OK",
				cancelText = "Cancelar",
				confirmVariant = "primary",
				onConfirm,
			} = options;

			showDialog({
				variant: "default",
				title,
				message,
				buttons: [
					{ text: cancelText, variant: "secondary" },
					{ text: confirmText, variant: confirmVariant, onPress: onConfirm },
				],
			});
		},
		[showDialog]
	);

	const value = useMemo(
		() => ({ showDialog, showError, showInfo, showSuccess, showConfirm, hideDialog }),
		[hideDialog, showConfirm, showDialog, showError, showInfo, showSuccess]
	);

	return (
		<DialogContext.Provider value={value}>
			{children}
			<AppDialog
				visible={Boolean(dialog)}
				variant={dialog?.variant}
				title={dialog?.title ?? ""}
				message={dialog?.message}
				buttons={dialog?.buttons}
				onClose={hideDialog}
			/>
		</DialogContext.Provider>
	);
}

export function useDialog() {
	const ctx = useContext(DialogContext);
	if (!ctx) throw new Error("useDialog deve ser usado dentro de DialogProvider");
	return ctx;
}
