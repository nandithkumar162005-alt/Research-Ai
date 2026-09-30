import { Sidebar } from '../components/Sidebar';
import { Outlet } from 'react-router-dom';

export const MainLayout = () => {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col h-full overflow-y-auto">
        <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-10 lg:px-14">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
