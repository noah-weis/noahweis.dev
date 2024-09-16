console.log("Script is loaded and running.");

document.addEventListener('DOMContentLoaded', function() {
    const imageBefore = document.getElementById('image-before');
    const imageAfter = document.getElementById('image-after');

    let isClicked = false;

    imageBefore.addEventListener('mouseover', () => {
        if (!isClicked) {
            imageBefore.classList.remove('active');
            imageAfter.classList.add('active');
        }
    });

    imageBefore.addEventListener('mouseout', () => {
        if (!isClicked) {
            imageAfter.classList.remove('active');
            imageBefore.classList.add('active');
        }
    });

    imageBefore.addEventListener('click', () => {
        if (!isClicked) {
            isClicked = true;
            imageBefore.classList.remove('active');
            imageAfter.classList.add('active');
        } else {
            isClicked = false;
            imageAfter.classList.remove('active');
            imageBefore.classList.add('active');
        }
    });
});