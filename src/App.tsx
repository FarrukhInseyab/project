import React from 'react';
import { AuthWrapper } from './components/AuthWrapper';
import { MainApp } from './components/MainApp';

function App() {
  return (
    <AuthWrapper>
      <MainApp />
    </AuthWrapper>
  );
}

export default App;