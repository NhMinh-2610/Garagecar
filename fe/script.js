document.addEventListener("DOMContentLoaded", () => {
  // Mobile Menu Toggle
  const hamburger = document.querySelector(".hamburger");
  const navLinks = document.querySelector(".nav-links");

  if (hamburger) {
    hamburger.addEventListener("click", () => {
      navLinks.classList.toggle("active");
      hamburger.classList.toggle("active");
    });
  }

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      e.preventDefault();
      if(navLinks) navLinks.classList.remove("active");
      if(hamburger) hamburger.classList.remove("active");

      const targetAttr = this.getAttribute("href");
      if(targetAttr === "#") return;

      const target = document.querySelector(targetAttr);
      if (target) {
        // Offset for fixed header
        const headerOffset = 80;
        const elementPosition = target.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
  
        window.scrollTo({
             top: offsetPosition,
             behavior: "smooth"
        });
      }
    });
  });

  // Form Submission Handler
  const form = document.getElementById("bookingForm");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const btn = form.querySelector("button");
      const originalText = btn.innerHTML;

      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xử lý...';
      btn.disabled = true;

      // Simulate API call
      setTimeout(() => {
        alert(
          "Cảm ơn bạn! Yêu cầu đặt lịch đã được gửi thành công. Chúng tôi sẽ liên hệ trong ít phút tới."
        );
        form.reset();
        btn.innerHTML = originalText;
        btn.disabled = false;
      }, 1500);
    });
  }

  // Scroll Navbar Effect
  const navbar = document.querySelector(".navbar");
  window.addEventListener("scroll", () => {
    if (window.scrollY > 50) {
      navbar.style.background = "rgba(11, 17, 32, 0.95)";
      navbar.style.boxShadow = "0 4px 20px rgba(0,0,0,0.4)";
    } else {
      navbar.style.background = "rgba(11, 17, 32, 0.85)";
      navbar.style.boxShadow = "none";
    }
  });

  // Stats Counter Animation using Intersection Observer
  const statNumbers = document.querySelectorAll('.stat-number');
  
  if(statNumbers.length > 0) {
      const animateValue = (obj, start, end, duration) => {
          let startTimestamp = null;
          const step = (timestamp) => {
              if (!startTimestamp) startTimestamp = timestamp;
              const progress = Math.min((timestamp - startTimestamp) / duration, 1);
              const currentVal = Math.floor(progress * (end - start) + start);
              
              // Formatting with 'k' or '+' based on original text
              if(end >= 1000) {
                  obj.innerHTML = (currentVal/1000).toFixed(end % 1000 === 0 ? 0 : 1).replace('.0','') + 'k+';
              } else {
                  obj.innerHTML = currentVal + '+';
              }
              
              if (progress < 1) {
                  window.requestAnimationFrame(step);
              } else {
                  // Ensure exact final text
                  if(end === 1000) obj.innerHTML = '1000+';
                  else if(end === 5000) obj.innerHTML = '5000+';
                  else obj.innerHTML = end + '+';
              }
          };
          window.requestAnimationFrame(step);
      };

      const observerOptions = {
          threshold: 0.5,
          rootMargin: "0px"
      };

      const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
              if (entry.isIntersecting) {
                  const target = entry.target;
                  const text = target.innerText;
                  let targetNumber = parseInt(text.replace(/\D/g, ''));
                  
                  // Special cases for k/m if present
                  if(text.toLowerCase().includes('k')) targetNumber = targetNumber * 1000;
                  
                  animateValue(target, 0, targetNumber, 2000);
                  observer.unobserve(target); // Only animate once
              }
          });
      }, observerOptions);

      statNumbers.forEach(stat => {
          observer.observe(stat);
      });
  }
});
