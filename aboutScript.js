document.querySelectorAll('.link-trigger').forEach(link => {
    link.addEventListener('click', function() {
        const images = {
            name: 'photo',
            UO: 'university-photo',
            computer: 'computer-photo',
            miata: 'miata-photo'
        };

        const selectedImageId = images[this.id];
        const activeImage = document.querySelector('.image-container img.active');
        const newImage = document.getElementById(selectedImageId);

        if (activeImage !== newImage) {
            activeImage.classList.remove('active');
            newImage.classList.add('active');
        }
    });
});
