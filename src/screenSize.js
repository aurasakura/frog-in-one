// The size of the screen the game fills, in CSS pixels. On phones
// window.innerWidth/innerHeight measure the zoomable visual viewport, which
// can be larger than the screen (a zoomed-out page) and would then size the
// canvas larger still; the layout viewport stays put.

export function screenWidth() {
    return document.documentElement.clientWidth;
}

export function screenHeight() {
    return document.documentElement.clientHeight;
}
