import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Protección universal contra NotFoundError removeChild / insertBefore
// Provocado cuando extensiones del navegador (Google Translate, traductores automáticos, etc.)
// modifican o envuelven nodos de texto en el DOM fuera del ciclo de reconciliación de React.
if (typeof Node === 'function' && Node.prototype) {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function (child) {
    if (child.parentNode !== this) {
      if (console && console.warn) {
        console.warn('Protección activa: se evitó removeChild en un nodo no hijo (extensión/traductor detectado):', child);
      }
      return child;
    }
    return originalRemoveChild.apply(this, arguments);
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function (newNode, referenceNode) {
    if (referenceNode && referenceNode.parentNode !== this) {
      if (console && console.warn) {
        console.warn('Protección activa: se evitó insertBefore en referencia no hija (extensión/traductor detectado):', referenceNode);
      }
      return newNode;
    }
    return originalInsertBefore.apply(this, arguments);
  };
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
