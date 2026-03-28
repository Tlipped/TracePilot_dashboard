// src/App.tsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ConfigProvider, theme, App as AntdApp } from 'antd'; // 引入 AntdApp 
import TaskList from './pages/TaskList';
import Dashboard from './pages/Dashboard'; // 我们接下来创建这个

function App() {
  return (
    <ConfigProvider theme={{ algorithm: theme.darkAlgorithm }}>
      {/* AntdApp 包裹器可以解决静态 message 警告 */}
      <AntdApp> 
        <Router>
          <div style={{ minHeight: '100vh', background: '#000', color: '#fff' }}>
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