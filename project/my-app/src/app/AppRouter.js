import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '../shared/context/AuthContext';
import ProtectedRoute from '../shared/components/ProtectedRoute';
import PublicOnlyRoute from '../shared/components/PublicOnlyRoute';
import AppLayout from '../shared/components/AppLayout';

import LoginPage      from '../features/auth/LoginPage';
import HomePage       from '../features/dashboard/HomePage';
import ProjectsPage   from '../features/projects/ProjectsPage';
import ViewerProjectWorkspacePage from '../features/projects/ViewerProjectWorkspacePage';
import ViewerProjectBacklogPage   from '../features/projects/ViewerProjectBacklogPage';
import ViewerWorkItemDetailPage   from '../features/projects/ViewerWorkItemDetailPage';
import SprintsPage    from '../features/sprints/SprintsPage';
import CreateProjectPage from '../features/projects/CreateProjectPage';
import UsersPage      from '../features/users/UsersPage';
import AuditPage      from '../features/audit/AuditPage';
import LeaderboardPage from '../features/leaderboard/LeaderboardPage';
import SprintBoard    from '../features/sprintBoard/SprintBoard';
import WorkItemsPage  from '../features/work_items/WorkItemsPage';
import CostsPage      from '../features/costs/CostsPage';
import ProjectBlockersPage from '../features/projects/ProjectBlockersPage';

export default function AppRouter() {
    return (
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <AuthProvider>
                <Routes>
                    {/* /login — redirige si ya está autenticado */}
                    <Route
                        path="/login"
                        element={
                            <PublicOnlyRoute>
                                <LoginPage />
                            </PublicOnlyRoute>
                        }
                    />

                    {/* Todas las rutas de la app comparten AppLayout (Sidebar + Outlet) */}
                    <Route
                        element={
                            <ProtectedRoute>
                                <AppLayout />
                            </ProtectedRoute>
                        }
                    >
                        <Route index element={<Navigate to="/projects" replace />} />
                        <Route path="/home"     element={<HomePage />} />

                        {/* ── Proyectos ────────────────────────────────────── */}
                        <Route path="/projects" element={<ProjectsPage />} />

                        {/* Vista de proyecto — viewer y PM pueden ver */}
                        <Route
                            path="/projects/:id/view"
                            element={
                                <ProtectedRoute roles={['viewer', 'pm', 'admin']}>
                                    <ViewerProjectWorkspacePage />
                                </ProtectedRoute>
                            }
                        />

                        {/* Backlog — solo viewer */}
                        <Route
                            path="/projects/:id/backlog"
                            element={
                                <ProtectedRoute roles={['viewer']}>
                                    <ViewerProjectBacklogPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/projects/:id/backlog/:itemId"
                            element={
                                <ProtectedRoute roles={['viewer']}>
                                    <ViewerWorkItemDetailPage />
                                </ProtectedRoute>
                            }
                        />

                        {/* Sprints */}
                        <Route
                            path="/projects/:id/sprints"
                            element={
                                <ProtectedRoute roles={['viewer', 'pm', 'admin']}>
                                    <SprintsPage />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/projects/:id/sprint-board/:id_sprint"
                            element={
                                <ProtectedRoute roles={['viewer', 'pm', 'admin']}>
                                    <SprintBoard />
                                </ProtectedRoute>
                            }
                        />

                        {/* ── Work Items (HU-09) — exclusivo PM / admin ──── */}
                        <Route
                            path="/projects/:id/work-items"
                            element={
                                <ProtectedRoute roles={['pm', 'admin']}>
                                    <WorkItemsPage />
                                </ProtectedRoute>
                            }
                        />

                        <Route
                            path="/projects/:id/blockers"
                            element={
                                <ProtectedRoute roles={['pm', 'admin']}>
                                    <ProjectBlockersPage />
                                </ProtectedRoute>
                            }
                        />

                        {/* ── Nuevo proyecto ────────────────────────────── */}
                        <Route
                            path="/projects/new"
                            element={
                                <ProtectedRoute roles={['pm', 'admin']}>
                                    <CreateProjectPage />
                                </ProtectedRoute>
                            }
                        />

                        {/* ── Usuarios ──────────────────────────────────── */}
                        <Route
                            path="/users"
                            element={
                                <ProtectedRoute roles={['pm', 'admin']}>
                                    <UsersPage />
                                </ProtectedRoute>
                            }
                        />

                        {/* ── Costos (HU-12, HU-13) — todos los roles miembros del proyecto ── */}
                        <Route
                            path="/projects/:id/costs"
                            element={
                                <ProtectedRoute roles={['viewer', 'pm', 'admin']}>
                                    <CostsPage />
                                </ProtectedRoute>
                            }
                        />

                        <Route path="/audit"       element={<AuditPage />} />
                        <Route path="/leaderboard" element={<LeaderboardPage />} />
                    </Route>

                    {/* Catch-all */}
                    <Route path="*" element={<Navigate to="/projects" replace />} />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    );
}