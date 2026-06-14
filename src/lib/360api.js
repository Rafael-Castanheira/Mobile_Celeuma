export { getMe, loginUser, recoverPassword, registerUser } from "./api/auth";

export {
    blockUser, deleteUser,
    getUsers, unblockUser, updateUserRole
} from "./api/users";

export {
    createPonto, deletePonto, getMapPoints,
    getPointCategories, getPointDetails, updatePonto
} from "./api/points";

export { getPointMobileData } from "./api/hotspots";

export {
    createTrajeto, deleteRota, getHighlightedRoute, getMapRoutes, highlightRoute, updateTrajetoDescription
} from "./api/routes";

export { addFavoritePoint, addFavoriteTrajeto, getMyFavorites, removeFavoritePoint, removeFavoriteTrajeto } from "./api/favorites";

export { getEstatisticasResumo, registarVisualizacao } from "./api/stats";

export {
    getActiveThemePreset, getLandingContent, getThemePresets, setActiveThemePreset
} from "./api/theme";

