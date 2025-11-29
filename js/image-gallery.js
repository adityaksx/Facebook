/**
 * Image gallery + PhotoSwipe + TUI editor
 * ---------------------------------------
 * - Per-post galleries via [data-pswp-gallery]
 * - Images + Cloudflare .mp4 videos in same gallery
 * - Native <video> for mp4 (R2 URLs)
 * - Thumbnails strip
 * - Admin "Edit" button using TUI image editor
 */

let currentLightbox = null;
window.photoSwipeInstance = null;
let currentPswp = null;
let tuiImageEditor = null;
let currentEditingPostId = null;
let currentEditingImageIndex = 0;
let currentEditingImageSrc = null;

/* ===========================
 *  PhotoSwipe initialization
 * ===========================
 */
function initPhotoSwipe() {
  console.log("🔍 PhotoSwipe check:", typeof PhotoSwipeLightbox, typeof PhotoSwipe);

  if (typeof PhotoSwipeLightbox === "undefined" || typeof PhotoSwipe === "undefined") {
    console.error("❌ PhotoSwipe libraries not loaded!");
    return;
  }

  // Destroy previous instance (when new posts are appended)
  if (currentLightbox) {
    currentLightbox.destroy();
    currentLightbox = null;
  }

  const lightbox = new PhotoSwipeLightbox({
    gallerySelector: "[data-pswp-gallery]",
    childSelector: "a",
    pswpModule: PhotoSwipe,
    padding: { top: 50, bottom: 130, left: 20, right: 20 },
    bgOpacity: 0.95,
    loop: true
  });

  lightbox.on('afterInit', () => {
    // Save pswp instance for later
    currentLightbox = lightbox;

    // When viewer opens, push a fake state
    if (!history.state || !history.state.photoswipeOpen) {
      history.pushState({ photoswipeOpen: true }, '');
    }
  });

  lightbox.on('close', () => {
    // When viewer closes via UI, go back once to clean the fake state
    if (history.state && history.state.photoswipeOpen) {
      history.back();
    }
  });


  /* ------------------------------
   *  Custom content loader (video)
   * ------------------------------ */
  lightbox.on("contentLoad", (e) => {
    const slide = e.slide;
    if (!slide || !slide.data || !slide.data.element) return;

    const element = slide.data.element;
    const type = element.getAttribute("data-type"); // "video" for our video anchors

    // Only intercept our video slides; images use default behavior.
    if (type !== "video") return;

    e.preventDefault(); // we will provide slide.content ourselves

    const videoSrc = (element.getAttribute("data-video-src") || element.getAttribute("href") || "").trim();
    if (!videoSrc) {
      console.warn("⚠️ No videoSrc on element", element);
      return;
    }

    // Consider it mp4 if URL ends with .mp4 or is a Cloudflare R2 URL
    const isMp4 =
      /\.mp4(\?|$)/i.test(videoSrc) ||
      videoSrc.includes("mime=video/mp4") ||
      videoSrc.includes(".r2.dev");

    // Container for any media we decide to mount
    const mount = document.createElement("div");
    mount.style.width = "100%";
    mount.style.height = "100%";
    mount.style.display = "flex";
    mount.style.alignItems = "center";
    mount.style.justifyContent = "center";
    mount.style.background = "#000";

    // Helper: fallback UI when everything fails
    const showFallbackLink = (message) => {
      mount.innerHTML = `
        <div style="color:#fff;text-align:center;padding:20px;">
          <p>${message || "Video could not be loaded."}</p>
          <a href="${videoSrc}" target="_blank" rel="noopener" style="color:#1877f2;">Open in new tab</a>
        </div>
      `;
      slide.content = mount;
    };

    // Preferred: native <video> for mp4
    if (isMp4) {
      const video = document.createElement("video");
      video.controls = true;
      video.playsInline = true;
      video.style.width = "100%";
      video.style.height = "100%";
      video.style.maxWidth = "100%";
      video.style.maxHeight = "100%";
      video.preload = "metadata";
      video.crossOrigin = "anonymous"; // works with your R2 CORS

      video.src = videoSrc;
      console.log("🎬 Loading video:", videoSrc);

      video.addEventListener("error", (err) => {
        console.error("Video load error:", err, video.error);
        showFallbackLink("Video failed to load.");
      });

      mount.appendChild(video);
      slide.content = mount;
      return;
    }

    // Fallback: iframe embed (for non-mp4 URLs, YouTube, etc.)
    const iframe = document.createElement("iframe");
    iframe.src = videoSrc;
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "0";
    iframe.setAttribute("allowfullscreen", "true");
    iframe.setAttribute("allow", "autoplay; fullscreen; picture-in-picture");
    iframe.addEventListener("error", () => showFallbackLink());
    mount.appendChild(iframe);
    slide.content = mount;
  });

  /* ------------------------------
   *  Admin "Edit" button
   * ------------------------------ */
  lightbox.on("uiRegister", () => {
    if (!isAdmin) return;

    lightbox.pswp.ui.registerElement({
      name: "edit-button",
      order: 9,
      isButton: true,
      html: "✏️ Edit",
      onClick: () => {
        const currentSlide = lightbox.pswp.currSlide;
        const imageSrc = currentSlide?.data?.src;
        const linkElement = currentSlide?.data?.element;

        if (!imageSrc || !linkElement) return;

        const postCard = linkElement.closest("[data-post-id]");
        const postId = postCard ? postCard.getAttribute("data-post-id") : null;

        const allImagesInPost = postCard ? postCard.querySelectorAll("a[data-pswp-src]") : [];
        let imageIndex = 0;
        allImagesInPost.forEach((a, idx) => {
          if (a.getAttribute("data-pswp-src") === imageSrc) imageIndex = idx;
        });

        currentEditingPostId = postId;
        currentEditingImageIndex = imageIndex;

        lightbox.pswp.close();
        setTimeout(() => openTuiEditor(imageSrc, postId, imageIndex), 300);
      }
    });
  });

  /* ------------------------------
   *  Thumbnails strip
   * ------------------------------ */
  lightbox.on("afterInit", () => {
    const pswpElement = lightbox.pswp.element;
    if (!pswpElement) return;

    const existingThumbs = pswpElement.querySelector(".pswp__thumbnails");
    if (existingThumbs) existingThumbs.remove();

    const thumbContainer = document.createElement("div");
    thumbContainer.className = "pswp__thumbnails";

    const numItems = lightbox.pswp.getNumItems();
    console.log(`✅ Creating ${numItems} thumbnails`);

    for (let i = 0; i < numItems; i++) {
      const slideData = lightbox.pswp.getItemData(i);
      if (!slideData) continue;

      const thumb = document.createElement("img");

      // Choose a thumbnail for all slide types (image / video)
      const msrc =
        slideData.msrc ||
        slideData.src ||
        (slideData.html &&
          (new DOMParser()
            .parseFromString(slideData.html, "text/html")
            .querySelector("img") || {}
          ).src) ||
        "video-placeholder.png";

      thumb.src = msrc;
      thumb.className = "pswp__thumbnail";
      thumb.dataset.index = String(i);

      if (i === lightbox.pswp.currIndex) {
        thumb.classList.add("active");
      }

      thumb.onclick = () => lightbox.pswp.goTo(i);
      thumbContainer.appendChild(thumb);
    }

    pswpElement.appendChild(thumbContainer);

    setTimeout(() => {
      const activeThumb = thumbContainer.querySelector(".pswp__thumbnail.active");
      if (activeThumb) {
        activeThumb.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center"
        });
      }
    }, 100);
  });

  // Update active thumbnail when slide changes
  lightbox.on("change", () => {
    const thumbs = document.querySelectorAll(".pswp__thumbnail");
    const currentIndex = lightbox.pswp.currIndex;

    thumbs.forEach((thumb, i) => {
      if (i === currentIndex) {
        thumb.classList.add("active");
        thumb.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      } else {
        thumb.classList.remove("active");
      }
    });
  });

  lightbox.init();
  currentLightbox = lightbox;
  console.log("✅ PhotoSwipe lightbox initialized");
}

/* ===========================
 *  TUI Image Editor
 * ===========================
 */
function initTuiEditor() {
  if (tuiImageEditor) return;

  if (typeof tui === "undefined" || typeof tui.ImageEditor === "undefined") {
    console.error("❌ Tui ImageEditor not loaded!");
    return;
  }
  if (typeof fabric === "undefined") {
    console.error("❌ Fabric.js not loaded!");
    return;
  }

  tuiImageEditor = new tui.ImageEditor("#tuiImageEditorContainer", {
    includeUI: {
      loadImage: { path: "", name: "Image" },
      theme: {
        "common.bi.image": "",
        "common.bisize.width": "0px",
        "common.bisize.height": "0px",
        "common.backgroundImage": "none",
        "common.backgroundColor": "#1e1e1e",
        "common.border": "0px"
      },
      menu: ["crop", "flip", "rotate", "draw", "shape", "icon", "text", "filter"],
      initMenu: "",
      uiSize: { width: "100%", height: "100%" },
      menuBarPosition: "bottom"
    },
    cssMaxWidth: 1400,
    cssMaxHeight: 900,
    usageStatistics: false
  });

  console.log("✅ Tui Image Editor initialized");
}

/**
 * Open TUI editor with image (admin only)
 */
function openTuiEditor(imageSrc, postId, imageIndex) {
  if (!isAdmin) {
    Toastify({
      text: "⚠️ Only admins can edit images",
      duration: 3000,
      gravity: "top",
      position: "center",
      style: { background: "#ff9800" }
    }).showToast();
    return;
  }

  currentEditingImageSrc = imageSrc;
  currentEditingPostId = postId;
  currentEditingImageIndex = imageIndex;

  if (!tuiImageEditor) initTuiEditor();
  if (!tuiImageEditor) {
    alert("Editor failed to initialize. Check console for errors.");
    return;
  }

  document.getElementById("tuiEditorModal").style.display = "flex";

  tuiImageEditor
    .loadImageFromURL(imageSrc, "EditImage")
    .then(() => {
      console.log("✅ Image loaded in editor");
      setTimeout(() => {
        tuiImageEditor.ui.activeMenuEvent();
        tuiImageEditor.ui.changeMenu("filter");
        console.log("✅ Editor tools activated");
      }, 500);
    })
    .catch((err) => {
      console.error("❌ Failed to load image:", err);
      Toastify({
        text: "❌ Failed to load image for editing",
        duration: 4000,
        gravity: "top",
        position: "center",
        style: { background: "#ff4444" }
      }).showToast();
      document.getElementById("tuiEditorModal").style.display = "none";
    });
}

/**
 * Setup TUI editor save / close
 */
function setupTuiEditorHandlers() {
  const closeBtn = document.getElementById("tuiEditorClose");
  const modal = document.getElementById("tuiEditorModal");

  if (closeBtn) {
    closeBtn.onclick = () => {
      modal.style.display = "none";
      if (tuiImageEditor) {
        tuiImageEditor.clearObjects();
        tuiImageEditor.clearRedoStack();
        tuiImageEditor.clearUndoStack();
      }
    };
  }

  const saveBtn = document.getElementById("tuiEditorSave");
  if (saveBtn) {
    saveBtn.onclick = async () => {
      if (!tuiImageEditor || !isAdmin) return;

      saveBtn.disabled = true;
      saveBtn.textContent = "⏳ Saving...";

      try {
        const dataURL = tuiImageEditor.toDataURL();
        const blob = await fetch(dataURL).then((r) => r.blob());
        const file = new File([blob], `edited_${Date.now()}.png`, { type: "image/png" });

        const newImageUrl = await AdminActions.uploadImageToSupabase(file);

        const { data: post } = await supabaseClient
          .from("posts")
          .select("images(id)")
          .eq("id", currentEditingPostId)
          .single();

        if (post && post.images && post.images[currentEditingImageIndex]) {
          const imageToUpdate = post.images[currentEditingImageIndex];

          await supabaseClient
            .from("images")
            .update({ url: newImageUrl })
            .eq("id", imageToUpdate.id);

          Toastify({
            text: "✅ Image updated successfully!",
            duration: 3000,
            gravity: "top",
            position: "right",
            style: { background: "linear-gradient(to right, #00b09b, #96c93d)" }
          }).showToast();

          modal.style.display = "none";
          setTimeout(() => location.reload(), 1500);
        } else {
          throw new Error("Image not found in post");
        }
      } catch (err) {
        console.error("❌ Save error:", err);
        Toastify({
          text: `❌ Failed: ${err.message}`,
          duration: 4000,
          gravity: "top",
          position: "right",
          style: { background: "#ff4444" }
        }).showToast();
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "💾 Save";
      }
    };
  }
}

console.log("✅ Image gallery loaded");

// Expose to global scope
window.openTuiEditor = openTuiEditor;
window.ImageGallery = {
  initPhotoSwipe,
  initTuiEditor,
  openTuiEditor,
  setupTuiEditorHandlers
};

window.addEventListener('popstate', () => {
  // If PhotoSwipe is open, close it instead of leaving the page
  if (currentLightbox && currentLightbox.pswp && !currentLightbox.pswp.isDestroying) {
    currentLightbox.pswp.close();

    // Restore fake state so the next back really navigates away
    if (!history.state || !history.state.photoswipeOpen) {
      history.pushState({ photoswipeOpen: true }, '');
    }
  }
});
