// src/App.tsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ConfigProvider, theme, App as AntdApp } from 'antd';
import TaskList from './pages/TaskList';
import Dashboard from './pages/Dashboard';
import './App.css';

function App() {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#38bdf8',
          colorInfo: '#38bdf8',
          colorSuccess: '#22c55e',
          colorWarning: '#f59e0b',
          colorError: '#ef4444',
          colorBgBase: '#0b0f14',
          colorTextBase: '#e5e7eb',
          colorBorder: '#263244',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          borderRadius: 6,
          wireframe: false,
          fontSize: 14,
        },
        components: {
          Layout: {
            headerBg: 'rgba(11,15,20,0.94)',
            bodyBg: 'transparent',
          },
          Card: {
            colorBgContainer: '#111827',
            colorBorderSecondary: '#263244',
            borderRadiusLG: 8,
          },
          Table: {
            colorBgContainer: 'transparent',
            headerBg: 'transparent',
            headerColor: '#94a3b8',
            rowHoverBg: 'rgba(56,189,248,0.06)',
            borderColor: '#263244',
          },
          Modal: {
            contentBg: '#111827',
            headerBg: 'transparent',
            titleColor: '#e5e7eb',
          },
          Button: {
            primaryShadow: 'none',
            defaultBorderColor: '#263244',
            defaultColor: '#e5e7eb',
            defaultBg: 'transparent',
          },
          Select: {
            selectorBg: '#0b0f14',
            optionSelectedBg: 'rgba(59,130,246,0.12)',
            optionActiveBg: 'rgba(59,130,246,0.08)',
          },
        },
      }}
    >
      <AntdApp>
        <Router>
          <div style={{ minHeight: '100vh', background: '#0b0f14', color: '#e5e7eb', position: 'relative', zIndex: 1 }}>
            <Routes>
              <Route path="/" element={<TaskList />} />
              <Route path="/tasks/:taskId" element={<Dashboard />} />
            </Routes>
          </div>
        </Router>
      </AntdApp>
    </ConfigProvider>
  );
}

export default App;
