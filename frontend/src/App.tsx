/**
 * Main App Component
 * Sets up routing and main layout
 */
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

// Pages
import EntitySelection from '@/pages/EntitySelection';
import Login from '@/pages/Login';
import Onboarding from '@/pages/Onboarding';
import AgreementCallback from '@/pages/AgreementCallback';

// Protected Route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

    if (!isAuthenticated) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
}

function App() {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

    return (
        <Router>
            <div className="min-h-screen">
                <Routes>
                    {/* Public Routes */}
                    <Route
                        path="/"
                        element={
                            isAuthenticated ? (
                                <Navigate to="/onboarding" replace />
                            ) : (
                                <EntitySelection />
                            )
                        }
                    />
                    <Route
                        path="/login"
                        element={
                            isAuthenticated ? (
                                <Navigate to="/onboarding" replace />
                            ) : (
                                <Login />
                            )
                        }
                    />

                    {/* Protected Routes */}
                    <Route
                        path="/onboarding/*"
                        element={
                            <ProtectedRoute>
                                <Onboarding />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/agreement/callback"
                        element={
                            <ProtectedRoute>
                                <AgreementCallback />
                            </ProtectedRoute>
                        }
                    />

                    {/* Catch all */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </div>
        </Router>
    );
}

export default App;
