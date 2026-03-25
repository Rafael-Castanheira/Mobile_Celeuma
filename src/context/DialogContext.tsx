import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import AppDialog, {
    type AppDialogButton,
    type AppDialogButtonVariant,
    type AppDialogVariant,
} from "../components/AppDialog";

export type DialogOptions = {
	variant?: AppDialogVariant;
	title: string;
	message?: string;
	buttons?: AppDialogButton[];
};

type DialogContextValue = {
	showDialog: (options: DialogOptions) => void;
	showError: (message: string, title?: string) => void;
	showInfo: (message: string, title?: string) => void;
	showSuccess: (message: string, title?: string) => void;
	showConfirm: (options: {
		title: string;
		message?: string;
		confirmText?: string;
		cancelText?: string;
		confirmVariant?: AppDialogButtonVariant;
		onConfirm: () => void | Promise<void>;
	}) => void;
	hideDialog: () => void;
};

type ConfirmOptions = {
	title: string;
	message?: string;
	confirmText?: string;
	cancelText?: string;
	confirmVariant?: AppDialogButtonVariant;
	onConfirm: () => void | Promise<void>;
};

const DialogContext = createContext<DialogContextValue | null>(null);

export function DialogProvider({ children }: { children: ReactNode }) {
	const [dialog, setDialog] = useState<DialogOptions | null>(null);

	const hideDialog = useCallback(() => setDialog(null), []);

	const showDialog = useCallback((options: DialogOptions) => {
		setDialog(options);
	}, []);

	const showError = useCallback(
		(message: string, title = "Erro") => {
			showDialog({ variant: "error", title, message, buttons: [{ text: "OK", variant: "primary" }] });
		},
		[showDialog]
	);

	const showInfo = useCallback(
		(message: string, title = "Aviso") => {
			showDialog({ variant: "info", title, message, buttons: [{ text: "OK", variant: "primary" }] });
		},
		[showDialog]
	);

	const showSuccess = useCallback(
		(message: string, title = "Sucesso") => {
			showDialog({ variant: "success", title, message, buttons: [{ text: "OK", variant: "primary" }] });
		},
		[showDialog]
	);

	const showConfirm = useCallback(
		(options: ConfirmOptions) => {
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

	const value = useMemo<DialogContextValue>(
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
