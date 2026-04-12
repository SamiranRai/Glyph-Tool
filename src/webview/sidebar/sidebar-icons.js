/* eslint-env browser */
/* global window, document, MutationObserver */

(function (global) {
  function loadIcon(iconElement) {
    const iconName = iconElement.getAttribute("data-icon");
    const iconPath = `${global.iconsBaseUri}/${iconName}.svg`;

    fetch(iconPath)
      .then((response) => response.text())
      .then((svg) => {
        iconElement.innerHTML = svg;
      })
      .catch((error) => console.error(`Error loading icon: ${iconName}`, error));
  }

  function loadIcons(root = document) {
    root.querySelectorAll(".icon-container").forEach((iconElement) => {
      loadIcon(iconElement);
    });
  }

  function observeIcons() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            if (node.matches(".icon-container")) {
              loadIcon(node);
            }
            node.querySelectorAll?.(".icon-container").forEach((innerNode) => {
              loadIcon(innerNode);
            });
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return observer;
  }

  global.sidebarIcons = {
    loadIcons,
    observeIcons,
  };
})(window);