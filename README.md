# Dados 3D corregidos

Esta versión corrige dos problemas:

1. Cada tipo de dado usa una geometría distinta:
   - D4: tetraedro
   - D6: cubo
   - D8: octaedro
   - D10: bipirámide pentagonal de 10 caras
   - D12: dodecaedro
   - D20: icosaedro
2. El número informado como resultado se orienta hacia arriba al terminar la animación.

## Publicación en GitHub Pages

Sube `index.html`, `styles.css` y `script.js` a la raíz del repositorio. Luego activa:

Settings → Pages → Deploy from a branch → main → /root

## Importante

La visualización 3D utiliza Three.js desde CDN, por lo que el dispositivo necesita conexión a Internet al abrir la página.
