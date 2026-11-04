const handleFileUpload = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const formData = new FormData();
  // MUST use "file" as the key name for FastAPI
  formData.append("file", file);

  try {
    const response = await fetch("https://lego-inventory-backend.onrender.com/upload-csv", {
      method: "POST",
      // DO NOT set 'Content-Type': 'multipart/form-data' here. 
      // The browser must automatically assign the multipart boundary.
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Server returned status ${response.status}`);
    }

    const data = await response.json();
    console.log("Success:", data);
    alert(data.message);
  } catch (err) {
    console.error("Upload error:", err);
    alert("Upload failed. Make sure the backend server is awake at https://lego-inventory-backend.onrender.com/");
  }
};
