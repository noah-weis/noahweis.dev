const cropImage = () => {
  if (!imageRef.current || !cropRef.current) return;

  const image = imageRef.current;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Calculate square dimensions based on the smaller dimension
  const size = Math.min(image.naturalWidth, image.naturalHeight);
  
  // Set canvas size to the square dimensions
  canvas.width = size;
  canvas.height = size;

  // Calculate crop coordinates to align to the right
  const sourceX = image.naturalWidth - size;
  const sourceY = (image.naturalHeight - size) / 2;

  // Draw the cropped image
  ctx.drawImage(
    image,
    sourceX, sourceY, size, size,  // Source rectangle (right-aligned square)
    0, 0, size, size               // Destination rectangle (full canvas)
  );

  // Convert to blob and create URL
  canvas.toBlob((blob) => {
    if (blob) {
      const url = URL.createObjectURL(blob);
      setImageUrl(url);
      setCropMode(false);
    }
  }, 'image/jpeg', 0.95);
}; 