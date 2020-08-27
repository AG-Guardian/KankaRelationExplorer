// https://docs.microsoft.com/en-us/windows/desktop/api/winuser/nf-winuser-setdoubleclicktime
const INTERVAL = 500;
function extension(interval = INTERVAL) {
    let clicked = null;
    this.on('click', (evt) => {
        if (clicked && clicked === evt.target) {
            clicked = null;
            evt.preventDefault();
            evt.stopPropagation();
            evt.target.emit('dblclick', [evt]);
        }
        else {
            clicked = evt.target;
            setTimeout(() => {
                if (clicked && clicked === evt.target) {
                    clicked = null;
                    evt.target.emit('dblclick:timeout', [evt]);
                }
            }, interval);
        }
    });
    return this; // chainability
}

function register(cy) {
    if (!cy) {
        return;
    }
    // Initialize extension
    // Register extension
    const extensionName = 'dblclick';
    cy('core', extensionName, extension);
    // cy('collection', extensionName, extension);
    // cy('layout', extensionName, extension);
    // cy('renderer', extensionName, extension);
}
if (typeof window.cytoscape !== 'undefined') {
    register(window.cytoscape);
}
// Extend cytoscape.Core
//import 'cytoscape';
