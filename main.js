class MatrixAnimation {
    constructor() {
        this.canvas = document.getElementById('matrix-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.overlay = document.getElementById('matrix-overlay');
        this.terminalText = document.getElementById('terminal-text');
        this.characters = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';
        this.drops = [];
        this.animationId = null;
        this.fadeTimeout = null;
        
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        const columns = Math.floor(this.canvas.width / 20);
        this.drops = Array(columns).fill(0).map(() => -Math.random() * 500); // Start above screen
    }

    start() {
        this.overlay.classList.add('active');
        this.animate();
        
        // After 2 seconds, start darkening the background
        setTimeout(() => {
            this.overlay.classList.add('darkening');
        }, 2000);
        
        // After 8 seconds, fade out matrix and show terminal text
        this.fadeTimeout = setTimeout(() => {
            this.fadeToTerminal();
        }, 8000);
    }
    
    fadeToTerminal() {
        // Fade out matrix
        this.canvas.style.transition = 'opacity 1s ease';
        this.canvas.style.opacity = '0';
        
        // Type terminal text
        setTimeout(() => {
            this.typeText("Follow the white rabbit.", () => {
                // After typing is done, show white rabbit and wait
                setTimeout(() => {
                    this.showWhiteRabbit();
                }, 1000);
            });
        }, 1000);
    }
    
    showWhiteRabbit() {
        // Add coreboot logo (white rabbit)
        const rabbitImg = document.createElement('img');
        rabbitImg.src = 'https://upload.wikimedia.org/wikipedia/commons/1/18/Coreboot_full.svg';
        rabbitImg.style.cssText = `
            width: 200px;
            height: auto;
            margin-top: 20px;
            margin-left: auto;
            margin-right: auto;
            display: block;
            opacity: 0;
            transition: opacity 1s ease;
            filter: brightness(0) invert(1);
        `;
        
        this.terminalText.innerHTML = 'Follow the white rabbit.';
        this.terminalText.appendChild(document.createElement('br'));
        this.terminalText.appendChild(rabbitImg);
        
        // Fade in the rabbit logo
        setTimeout(() => {
            rabbitImg.style.opacity = '1';
        }, 500);
        
        // Wait 3 seconds then proceed to game
        setTimeout(() => {
            this.stop();
        }, 3000);
    }
    
    typeText(text, callback) {
        this.terminalText.classList.add('visible');
        let i = 0;
        const typing = () => {
            if (i < text.length) {
                this.terminalText.textContent = text.substring(0, i + 1);
                i++;
                setTimeout(typing, 100);
            } else {
                callback();
            }
        };
        typing();
    }

    animate() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.fillStyle = '#4fc3f7';
        this.ctx.font = '20px monospace';
        
        for (let i = 0; i < this.drops.length; i++) {
            const char = this.characters[Math.floor(Math.random() * this.characters.length)];
            this.ctx.fillText(char, i * 20, this.drops[i]);
            
            if (this.drops[i] > this.canvas.height && Math.random() > 0.975) {
                this.drops[i] = -Math.random() * 100; // Reset to above screen
            }
            
            this.drops[i] += 20;
        }
        
        this.animationId = requestAnimationFrame(() => this.animate());
    }

    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        if (this.fadeTimeout) {
            clearTimeout(this.fadeTimeout);
            this.fadeTimeout = null;
        }
        
        // Reset styles
        this.canvas.style.opacity = '1';
        this.canvas.style.transition = '';
        this.terminalText.classList.remove('visible');
        this.terminalText.innerHTML = '';
        
        this.overlay.classList.remove('active', 'darkening');
        
        // Transition to real game
        const lockpicker = document.getElementById('lockpicker');
        const game = document.getElementById('game');
        if (lockpicker) lockpicker.classList.remove('active');
        if (game) game.classList.add('active');
    }
}

class KeyboardAdapter {
    constructor() {
        this.onSlotSelect = () => {};
        this.onDigitChange = () => {};
        this.onConfirm = () => {};
        
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
    }

    handleKeyDown(event) {
        switch (event.code) {
            case 'Digit1':
            case 'KeyO':
                this.onSlotSelect(0);
                break;
            case 'Digit2':
            case 'KeyS':
                this.onSlotSelect(1);
                break;
            case 'Digit3':
            case 'KeyF':
                this.onSlotSelect(2);
                break;
            case 'ArrowLeft':
            case 'ArrowDown':
                event.preventDefault();
                this.onDigitChange(-1);
                break;
            case 'ArrowRight':
            case 'ArrowUp':
                event.preventDefault();
                this.onDigitChange(1);
                break;
            case 'Enter':
            case 'Space':
                event.preventDefault();
                this.onConfirm();
                break;
        }
    }
}

class WebHIDAdapter {
    constructor() {
        this.onSlotSelect = () => {};
        this.onDigitChange = () => {};
        this.onConfirm = () => {};
        this.device = null;
    }

    async connect() {
        if (!('hid' in navigator)) {
            console.warn('WebHID not supported');
            return false;
        }

        try {
            const devices = await navigator.hid.requestDevice({
                filters: [{}]
            });

            if (devices.length > 0) {
                this.device = devices[0];
                await this.device.open();
                this.device.addEventListener('inputreport', this.handleInputReport.bind(this));
                return true;
            }
        } catch (error) {
            console.error('Failed to connect to HID device:', error);
        }

        return false;
    }

    handleInputReport(event) {
        const { data, reportId } = event;
        const bytes = new Uint8Array(data.buffer);
        
        // This is a placeholder - actual implementation would depend on your device's HID report format
        // You'll need to adjust this based on your custom keyboard's actual HID reports
        console.log('HID Report:', bytes);
        
        // Example mapping (adjust based on your device):
        if (bytes[0] === 0x01) { // Volume Up -> Digit change up
            this.onDigitChange(1);
        } else if (bytes[0] === 0x02) { // Volume Down -> Digit change down
            this.onDigitChange(-1);
        } else if (bytes[0] === 0x03) { // Mute -> Confirm
            this.onConfirm();
        } else if (bytes[0] >= 0x10 && bytes[0] <= 0x12) { // Custom keys
            this.onSlotSelect(bytes[0] - 0x10);
        }
    }

    disconnect() {
        if (this.device) {
            this.device.close();
            this.device = null;
        }
    }
}

class AudioManager {
    constructor() {
        this.audioContext = null;
        this.sounds = {};
    }

    async init() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Generate synthetic sounds
        this.sounds.tick = this.generateSound(800, 0.05, 'square');
        this.sounds.correct = this.generateSound(1200, 0.15, 'sine');
        this.sounds.unlock = this.generateUnlockSound();
    }

    generateSound(frequency, duration, type) {
        if (!this.audioContext) throw new Error('AudioContext not initialized');
        
        const sampleRate = this.audioContext.sampleRate;
        const buffer = this.audioContext.createBuffer(1, duration * sampleRate, sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < buffer.length; i++) {
            const t = i / sampleRate;
            let value = 0;
            
            if (type === 'sine') {
                value = Math.sin(2 * Math.PI * frequency * t);
            } else if (type === 'square') {
                value = Math.sin(2 * Math.PI * frequency * t) > 0 ? 1 : -1;
            }
            
            // Apply envelope
            const envelope = Math.exp(-t * 5);
            data[i] = value * envelope * 0.1;
        }

        return buffer;
    }

    generateUnlockSound() {
        if (!this.audioContext) throw new Error('AudioContext not initialized');
        
        const sampleRate = this.audioContext.sampleRate;
        const duration = 1.0;
        const buffer = this.audioContext.createBuffer(1, duration * sampleRate, sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < buffer.length; i++) {
            const t = i / sampleRate;
            const frequency = 400 + Math.sin(t * 10) * 200; // Sweeping frequency
            const value = Math.sin(2 * Math.PI * frequency * t);
            const envelope = Math.exp(-t * 2);
            data[i] = value * envelope * 0.15;
        }

        return buffer;
    }

    play(soundName) {
        if (!this.audioContext || !this.sounds[soundName]) return;

        const source = this.audioContext.createBufferSource();
        source.buffer = this.sounds[soundName];
        source.connect(this.audioContext.destination);
        source.start();
    }
}

class SeededRandom {
    constructor(seed = Date.now()) {
        this.seed = seed;
    }

    next() {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    }

    nextInt(max) {
        return Math.floor(this.next() * max);
    }
}

class LockPickerGame {
    constructor() {
        this.slots = [0, 0, 0];
        this.currentSlot = 0;
        this.targetCode = [];
        this.correctSlots = [false, false, false];
        this.unlocked = false;
        this.charset = '0123456789';

        // Initialize input adapters
        this.inputAdapter = new KeyboardAdapter();
        this.webHIDAdapter = new WebHIDAdapter();
        this.audioManager = new AudioManager();
        this.matrixAnimation = new MatrixAnimation();

        // Get seed from URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        const seed = urlParams.get('seed') ? parseInt(urlParams.get('seed'), 10) : Date.now();
        this.random = new SeededRandom(seed);

        // Get DOM elements
        this.slotElements = Array.from(document.querySelectorAll('.slot'));
        this.digitElements = Array.from(document.querySelectorAll('.digit-display'));
        this.safeElement = document.querySelector('.safe');

        this.init();
    }

    async init() {
        await this.audioManager.init();
        this.generateTargetCode();
        this.setupInputHandlers();
        this.setupUI();
        this.updateDisplay();
    }

    generateTargetCode() {
        this.targetCode = [
            this.random.nextInt(this.charset.length),
            this.random.nextInt(this.charset.length),
            this.random.nextInt(this.charset.length)
        ];
        console.log('Target code:', this.targetCode.map(i => this.charset[i]).join(''));
    }

    setupInputHandlers() {
        this.inputAdapter.onSlotSelect = (slot) => this.selectSlot(slot);
        this.inputAdapter.onDigitChange = (direction) => this.changeDigit(direction);
        this.inputAdapter.onConfirm = () => this.confirmSlot();

        this.webHIDAdapter.onSlotSelect = (slot) => this.selectSlot(slot);
        this.webHIDAdapter.onDigitChange = (direction) => this.changeDigit(direction);
        this.webHIDAdapter.onConfirm = () => this.confirmSlot();
    }

    setupUI() {
        // Enter combination button
        const enterButton = document.getElementById('enter-combination');
        enterButton.addEventListener('click', () => {
            this.checkCombination();
        });

        // Reset button
        const resetButton = document.getElementById('reset-game');
        if (resetButton) {
            resetButton.addEventListener('click', () => this.reset());
        }

        // Slot click handlers
        this.slotElements.forEach((slot, index) => {
            slot.addEventListener('click', () => this.selectSlot(index));
        });
    }

    selectSlot(slotIndex) {
        if (this.unlocked || slotIndex < 0 || slotIndex >= 3) return;

        this.currentSlot = slotIndex;
        this.updateSlotHighlights();
        this.audioManager.play('tick');
    }

    changeDigit(direction) {
        if (this.unlocked) return;

        const oldValue = this.slots[this.currentSlot];
        this.slots[this.currentSlot] = (this.slots[this.currentSlot] + direction + this.charset.length) % this.charset.length;
        
        // Remove correct status when changing a previously correct slot
        this.correctSlots[this.currentSlot] = false;
        this.slotElements[this.currentSlot].classList.remove('correct');
        
        this.animateDigitChange(this.currentSlot, oldValue, this.slots[this.currentSlot]);
        
        // Play correct sound if digit matches target, otherwise tick
        if (this.slots[this.currentSlot] === this.targetCode[this.currentSlot]) {
            this.audioManager.play('correct');
        } else {
            this.audioManager.play('tick');
        }
    }

    confirmSlot() {
        if (this.unlocked) return;

        const isCorrect = this.slots[this.currentSlot] === this.targetCode[this.currentSlot];
        this.correctSlots[this.currentSlot] = isCorrect;
        
        if (isCorrect) {
            this.audioManager.play('correct');
            this.slotElements[this.currentSlot].classList.add('correct');
            
            // Move to next slot if this one is correct
            if (this.currentSlot < 2) {
                this.currentSlot++;
                this.updateSlotHighlights();
            }
        } else {
            this.slotElements[this.currentSlot].classList.remove('correct');
        }

        // Check if all slots are correct
        if (this.correctSlots.every(correct => correct)) {
            this.unlock();
        }
    }

    checkCombination() {
        if (this.unlocked) return;

        // Check if current combination matches target
        const isCorrect = this.slots.every((slot, index) => slot === this.targetCode[index]);
        
        if (isCorrect) {
            this.unlock();
        } else {
            // Show visual feedback for wrong combination
            this.safeElement.style.animation = 'shake 0.5s ease-in-out';
            setTimeout(() => {
                this.safeElement.style.animation = '';
            }, 500);
        }
    }

    animateDigitChange(slotIndex, oldValue, newValue) {
        const digitElement = this.digitElements[slotIndex];
        
        // Spin out animation
        digitElement.classList.add('spinning-out');
        
        setTimeout(() => {
            digitElement.textContent = this.charset[newValue];
            digitElement.classList.remove('spinning-out');
            digitElement.classList.add('spinning-in');
            
            setTimeout(() => {
                digitElement.classList.remove('spinning-in');
            }, 300);
        }, 150);
    }

    unlock() {
        this.unlocked = true;
        this.audioManager.play('unlock');
        
        // Add buzzing/shaking effect to the safe
        this.safeElement.style.animation = 'buzz 0.5s ease-in-out 3';
        
        setTimeout(() => {
            // Reset animation and start matrix
            this.safeElement.style.animation = '';
            this.matrixAnimation.start();
        }, 1500);
    }

    updateDisplay() {
        this.digitElements.forEach((element, index) => {
            element.textContent = this.charset[this.slots[index]];
        });
        this.updateSlotHighlights();
    }

    updateSlotHighlights() {
        this.slotElements.forEach((element, index) => {
            element.classList.toggle('active', index === this.currentSlot);
        });
    }

    reset() {
        // Reset game state
        this.slots = [0, 0, 0];
        this.currentSlot = 0;
        this.correctSlots = [false, false, false];
        this.unlocked = false;
        
        // Generate new target code
        this.generateTargetCode();
        
        // Reset UI
        this.safeElement.classList.remove('unlocked');
        this.slotElements.forEach(slot => {
            slot.classList.remove('correct');
        });
        
        // Switch back to lock picker screen
        const game = document.getElementById('game');
        const lockpicker = document.getElementById('lockpicker');
        if (game) game.classList.remove('active');
        if (lockpicker) lockpicker.classList.add('active');
        
        this.updateDisplay();
    }
}

// Initialize the game when the page loads
window.addEventListener('DOMContentLoaded', () => {
    new LockPickerGame();
});