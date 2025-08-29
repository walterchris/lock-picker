interface InputAdapter {
    onSlotSelect: (slot: number) => void;
    onDigitChange: (direction: 1 | -1) => void;
    onConfirm: () => void;
}

class KeyboardAdapter implements InputAdapter {
    onSlotSelect: (slot: number) => void = () => {};
    onDigitChange: (direction: 1 | -1) => void = () => {};
    onConfirm: () => void = () => {};

    constructor() {
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
    }

    private handleKeyDown(event: KeyboardEvent) {
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

class WebHIDAdapter implements InputAdapter {
    onSlotSelect: (slot: number) => void = () => {};
    onDigitChange: (direction: 1 | -1) => void = () => {};
    onConfirm: () => void = () => {};

    private device: HIDDevice | null = null;

    async connect(): Promise<boolean> {
        if (!('hid' in navigator)) {
            console.warn('WebHID not supported');
            return false;
        }

        try {
            const devices = await (navigator as any).hid.requestDevice({
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

    private handleInputReport(event: any) {
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
    private audioContext: AudioContext | null = null;
    private sounds: { [key: string]: AudioBuffer } = {};

    async init() {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        // Generate synthetic sounds
        this.sounds.tick = this.generateSound(800, 0.05, 'square');
        this.sounds.correct = this.generateSound(1200, 0.15, 'sine');
        this.sounds.unlock = this.generateUnlockSound();
    }

    private generateSound(frequency: number, duration: number, type: OscillatorType): AudioBuffer {
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

    private generateUnlockSound(): AudioBuffer {
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

    play(soundName: string) {
        if (!this.audioContext || !this.sounds[soundName]) return;

        const source = this.audioContext.createBufferSource();
        source.buffer = this.sounds[soundName];
        source.connect(this.audioContext.destination);
        source.start();
    }
}

class SeededRandom {
    private seed: number;

    constructor(seed: number = Date.now()) {
        this.seed = seed;
    }

    next(): number {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    }

    nextInt(max: number): number {
        return Math.floor(this.next() * max);
    }
}

class LockPickerGame {
    private slots: number[] = [0, 0, 0];
    private currentSlot: number = 0;
    private targetCode: number[] = [];
    private correctSlots: boolean[] = [false, false, false];
    private unlocked: boolean = false;
    private charset: string = '0123456789';

    private inputAdapter: InputAdapter;
    private webHIDAdapter: WebHIDAdapter;
    private audioManager: AudioManager;
    private random: SeededRandom;

    private slotElements: HTMLElement[];
    private digitElements: HTMLElement[];
    private safeElement: HTMLElement;

    constructor() {
        // Initialize input adapters
        this.inputAdapter = new KeyboardAdapter();
        this.webHIDAdapter = new WebHIDAdapter();
        this.audioManager = new AudioManager();

        // Get seed from URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        const seed = urlParams.get('seed') ? parseInt(urlParams.get('seed')!, 10) : Date.now();
        this.random = new SeededRandom(seed);

        // Get DOM elements
        this.slotElements = Array.from(document.querySelectorAll('.slot')) as HTMLElement[];
        this.digitElements = Array.from(document.querySelectorAll('.digit-display')) as HTMLElement[];
        this.safeElement = document.querySelector('.safe') as HTMLElement;

        this.init();
    }

    private async init() {
        await this.audioManager.init();
        this.generateTargetCode();
        this.setupInputHandlers();
        this.setupUI();
        this.updateDisplay();
    }

    private generateTargetCode() {
        this.targetCode = [
            this.random.nextInt(this.charset.length),
            this.random.nextInt(this.charset.length),
            this.random.nextInt(this.charset.length)
        ];
        console.log('Target code:', this.targetCode.map(i => this.charset[i]).join(''));
    }

    private setupInputHandlers() {
        this.inputAdapter.onSlotSelect = (slot: number) => this.selectSlot(slot);
        this.inputAdapter.onDigitChange = (direction: 1 | -1) => this.changeDigit(direction);
        this.inputAdapter.onConfirm = () => this.confirmSlot();

        this.webHIDAdapter.onSlotSelect = (slot: number) => this.selectSlot(slot);
        this.webHIDAdapter.onDigitChange = (direction: 1 | -1) => this.changeDigit(direction);
        this.webHIDAdapter.onConfirm = () => this.confirmSlot();
    }

    private setupUI() {
        // Connect device button
        const connectButton = document.getElementById('connect-device') as HTMLButtonElement;
        connectButton.addEventListener('click', async () => {
            connectButton.disabled = true;
            connectButton.textContent = 'Connecting...';
            
            const connected = await this.webHIDAdapter.connect();
            
            if (connected) {
                connectButton.textContent = 'Device Connected';
                connectButton.style.background = 'linear-gradient(145deg, #4caf50, #45a049)';
            } else {
                connectButton.textContent = 'Connection Failed';
                connectButton.disabled = false;
            }
        });

        // Reset button
        const resetButton = document.getElementById('reset-game');
        resetButton?.addEventListener('click', () => this.reset());

        // Slot click handlers
        this.slotElements.forEach((slot, index) => {
            slot.addEventListener('click', () => this.selectSlot(index));
        });
    }

    private selectSlot(slotIndex: number) {
        if (this.unlocked || slotIndex < 0 || slotIndex >= 3) return;

        this.currentSlot = slotIndex;
        this.updateSlotHighlights();
        this.audioManager.play('tick');
    }

    private changeDigit(direction: 1 | -1) {
        if (this.unlocked) return;

        const oldValue = this.slots[this.currentSlot];
        this.slots[this.currentSlot] = (this.slots[this.currentSlot] + direction + this.charset.length) % this.charset.length;
        
        this.animateDigitChange(this.currentSlot, oldValue, this.slots[this.currentSlot]);
        this.audioManager.play('tick');
    }

    private confirmSlot() {
        if (this.unlocked) return;

        const isCorrect = this.slots[this.currentSlot] === this.targetCode[this.currentSlot];
        this.correctSlots[this.currentSlot] = isCorrect;
        
        if (isCorrect) {
            this.audioManager.play('correct');
            this.slotElements[this.currentSlot].classList.add('correct');
        } else {
            this.slotElements[this.currentSlot].classList.remove('correct');
        }

        // Check if all slots are correct
        if (this.correctSlots.every(correct => correct)) {
            this.unlock();
        }
    }

    private animateDigitChange(slotIndex: number, oldValue: number, newValue: number) {
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

    private unlock() {
        this.unlocked = true;
        this.audioManager.play('unlock');
        this.safeElement.classList.add('unlocked');
        
        setTimeout(() => {
            // Transition to real game
            document.getElementById('lockpicker')?.classList.remove('active');
            document.getElementById('game')?.classList.add('active');
        }, 2000);
    }

    private updateDisplay() {
        this.digitElements.forEach((element, index) => {
            element.textContent = this.charset[this.slots[index]];
        });
        this.updateSlotHighlights();
    }

    private updateSlotHighlights() {
        this.slotElements.forEach((element, index) => {
            element.classList.toggle('active', index === this.currentSlot);
        });
    }

    private reset() {
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
        document.getElementById('game')?.classList.remove('active');
        document.getElementById('lockpicker')?.classList.add('active');
        
        this.updateDisplay();
    }
}

// Initialize the game when the page loads
window.addEventListener('DOMContentLoaded', () => {
    new LockPickerGame();
});