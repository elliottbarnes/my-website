// Ensure GSAP is loaded
if (typeof gsap === 'undefined') {
  console.error('GSAP library not loaded.');
} else {
  console.log('GSAP loaded successfully.');
}

// ROT13 function for email hiding from spambots
const rot13 = (message) => {
  const alpha = 'abcdefghijklmnopqrstuvwxyzabcdefghijklmABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLM';
  return message.replace(/[a-z]/gi, letter => alpha[alpha.indexOf(letter) + 13]);
};

let e_is_shown = false;
document.getElementById('iemail').addEventListener('click', function () {
  let demail = document.getElementById('demail');
  let msg = 'ryyvbggao55@vpybhq.pbz';  // Correct ROT13-encoded "elliottnb55@icloud.com"
  demail.innerHTML = e_is_shown ? '' : rot13(msg); // Decodes and displays email
  e_is_shown = !e_is_shown; // Toggle between showing and hiding the email
});

// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    document.querySelector(this.getAttribute('href')).scrollIntoView({
      behavior: 'smooth',
    });
  });
});

// Typing effect for the header
const messages = ["hey, i'm elliott :)", "welcome to my website !"];
let messageIndex = 0;
let charIndex = 0;
let isDeleting = false;
const typingSpeed = 100;
const deletingSpeed = 50;
const pauseDelay = 1000;

const typedTextElement = document.getElementById("typed-text");

function typeMessage() {
  const currentMessage = messages[messageIndex];
  if (isDeleting) {
    typedTextElement.innerHTML = currentMessage.substring(0, charIndex - 1);
    charIndex--;
  } else {
    typedTextElement.innerHTML = currentMessage.substring(0, charIndex + 1);
    charIndex++;
  }

  if (!isDeleting && charIndex === currentMessage.length) {
    // Start deleting after a pause
    setTimeout(() => {
      isDeleting = true;
    }, pauseDelay);
  } else if (isDeleting && charIndex === 0) {
    // Move to the next message after deleting
    isDeleting = false;
    messageIndex = (messageIndex + 1) % messages.length;
  }

  setTimeout(typeMessage, isDeleting ? deletingSpeed : typingSpeed);
}

// Start the typing effect
typeMessage();
