// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x3a2515);
scene.fog = new THREE.Fog(0x3a2515, 10, 50);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 8);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const container = document.getElementById('container');
container.appendChild(renderer.domElement);

// Lighting - warm desert ambiance
const ambientLight = new THREE.AmbientLight(0xf4e4c1, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffd700, 0.8);
directionalLight.position.set(5, 10, 7);
directionalLight.castShadow = true;
scene.add(directionalLight);

const pointLight = new THREE.PointLight(0xffaa00, 0.6);
pointLight.position.set(-5, 5, 5);
scene.add(pointLight);

// Sound effects
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

// Create heavy metal click sound for dial rotation
function playClickSound() {
    const now = audioContext.currentTime;
    
    // Create noise buffer for metallic sound
    const bufferSize = audioContext.sampleRate * 0.08;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    // Generate noise with decay
    for (let i = 0; i < bufferSize; i++) {
        const decay = 1 - (i / bufferSize);
        data[i] = (Math.random() * 2 - 1) * decay * 0.3;
    }
    
    const noise = audioContext.createBufferSource();
    noise.buffer = buffer;
    
    // Low-pass filter for metallic quality
    const filter = audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1200;
    filter.Q.value = 1;
    
    // Add a low thump
    const oscillator = audioContext.createOscillator();
    oscillator.frequency.value = 120;
    oscillator.type = 'triangle';
    
    const oscGain = audioContext.createGain();
    oscGain.gain.setValueAtTime(0.4, now);
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
    
    const noiseGain = audioContext.createGain();
    noiseGain.gain.setValueAtTime(0.5, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
    
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(audioContext.destination);
    
    oscillator.connect(oscGain);
    oscGain.connect(audioContext.destination);
    
    noise.start(now);
    noise.stop(now + 0.08);
    oscillator.start(now);
    oscillator.stop(now + 0.08);
}

// Create heavy metal unlock sound
function playUnlockSound() {
    const now = audioContext.currentTime;
    
    // Create metallic clang
    const bufferSize = audioContext.sampleRate * 0.8;
    const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
        const decay = Math.exp(-i / (audioContext.sampleRate * 0.3));
        data[i] = (Math.random() * 2 - 1) * decay * 0.4;
    }
    
    const noise = audioContext.createBufferSource();
    noise.buffer = buffer;
    
    const filter = audioContext.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 800;
    filter.Q.value = 2;
    
    // Deep metallic clunk
    const osc1 = audioContext.createOscillator();
    osc1.frequency.setValueAtTime(150, now);
    osc1.frequency.exponentialRampToValueAtTime(80, now + 0.3);
    osc1.type = 'triangle';
    
    // High metallic ring
    const osc2 = audioContext.createOscillator();
    osc2.frequency.value = 1800;
    osc2.type = 'sine';
    
    const gain1 = audioContext.createGain();
    gain1.gain.setValueAtTime(0.5, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    
    const gain2 = audioContext.createGain();
    gain2.gain.setValueAtTime(0.3, now);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
    
    const noiseGain = audioContext.createGain();
    noiseGain.gain.setValueAtTime(0.4, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
    
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(audioContext.destination);
    
    osc1.connect(gain1);
    gain1.connect(audioContext.destination);
    
    osc2.connect(gain2);
    gain2.connect(audioContext.destination);
    
    noise.start(now);
    noise.stop(now + 0.8);
    osc1.start(now);
    osc1.stop(now + 0.4);
    osc2.start(now);
    osc2.stop(now + 0.8);
}

// Cryptex configuration
const SYMBOLS = ['I', 'V', 'II', 'VV', 'III', 'VVV', 'IV', 'IVV'];
const CORRECT_CODE = ['I', 'IV', 'II', 'I']; // You can change this
const NUM_DIALS = 4;

// Materials
const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0xc9a961,
    metalness: 0.6,
    roughness: 0.4
});

const dialMaterial = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    metalness: 0.5,
    roughness: 0.5
});

const markerMaterial = new THREE.MeshStandardMaterial({
    color: 0x8b0000,
    metalness: 0.7,
    roughness: 0.3,
    emissive: 0x8b0000,
    emissiveIntensity: 0.3
});

// Cryptex state
const cryptex = new THREE.Group();
const dials = [];

// Generate random starting positions that don't match the correct code
const dialStates = CORRECT_CODE.map((correctSymbol, index) => {
    const correctIndex = SYMBOLS.indexOf(correctSymbol);
    let randomIndex;
    
    // Keep generating random indices until we get one that's not the correct one
    do {
        randomIndex = Math.floor(Math.random() * SYMBOLS.length);
    } while (randomIndex === correctIndex);
    
    return randomIndex;
});

let isUnlocked = false;

// Create main cryptex body
function createCryptexBody() {
    const bodyGroup = new THREE.Group();
    
    // Main cylinder
    const bodyGeometry = new THREE.CylinderGeometry(1.5, 1.5, 8, 32);
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.rotation.z = Math.PI / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    bodyGroup.add(body);
    
    // End caps
    const capGeometry = new THREE.CylinderGeometry(1.3, 1.3, 0.3, 32);
    const leftCap = new THREE.Mesh(capGeometry, bodyMaterial);
    leftCap.position.x = -4.2;
    leftCap.rotation.z = Math.PI / 2;
    leftCap.castShadow = true;
    bodyGroup.add(leftCap);
    
    const rightCap = new THREE.Mesh(capGeometry, bodyMaterial);
    rightCap.position.x = 4.2;
    rightCap.rotation.z = Math.PI / 2;
    rightCap.castShadow = true;
    bodyGroup.add(rightCap);
    
    // Decorative rings
    for (let i = -3; i <= 3; i += 1.5) {
        if (Math.abs(i) > 0.5) {
            const ringGeometry = new THREE.TorusGeometry(1.6, 0.08, 16, 32);
            const ring = new THREE.Mesh(ringGeometry, bodyMaterial);
            ring.position.x = i;
            ring.rotation.y = Math.PI / 2;
            bodyGroup.add(ring);
        }
    }
    
    // Add alignment notches
    const notchMaterial = new THREE.MeshStandardMaterial({
        color: 0x8b0000,
        metalness: 0.7,
        roughness: 0.3
    });
    
    // Calculate dial positions (same spacing as dials)
    const spacing = 1.8;
    const firstDialPos = -(NUM_DIALS - 1) / 2 * spacing;
    const lastDialPos = (NUM_DIALS - 1) / 2 * spacing;
    
    // Notch before first dial
    const notchGeometry = new THREE.BoxGeometry(0.225, 0.1, 0.1);
    const leftNotch = new THREE.Mesh(notchGeometry, notchMaterial);
    leftNotch.position.set(firstDialPos - 0.7, 1.55, 0);
    bodyGroup.add(leftNotch);
    
    // Notch after last dial
    const rightNotch = new THREE.Mesh(notchGeometry, notchMaterial);
    rightNotch.position.set(lastDialPos + 0.7, 1.55, 0);
    bodyGroup.add(rightNotch);
    
    return bodyGroup;
}

// Create a dial with symbols
function createDial(index) {
    const dialGroup = new THREE.Group();
    dialGroup.userData.index = index;
    dialGroup.userData.isHovered = false;
    
    // Dial cylinder (slightly larger than body)
    const dialGeometry = new THREE.CylinderGeometry(1.65, 1.65, 1.2, 32);
    const dialMesh = new THREE.Mesh(dialGeometry, dialMaterial);
    dialMesh.rotation.z = Math.PI / 2;
    dialMesh.castShadow = true;
    dialGroup.add(dialMesh);
    
    // Add symbols around the dial
    const symbolRadius = 1.7;
    const angleStep = (Math.PI * 2) / SYMBOLS.length;
    
    SYMBOLS.forEach((symbol, symbolIndex) => {
        const angle = symbolIndex * angleStep;
        const x = 0;
        const y = symbolRadius * Math.cos(angle);
        const z = symbolRadius * Math.sin(angle);
        
        // Create text using canvas texture
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#f4e4c1';
        ctx.font = 'bold 60px Georgia';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(symbol, 64, 64);
        
        const texture = new THREE.CanvasTexture(canvas);
        const symbolMaterial = new THREE.MeshBasicMaterial({ 
            map: texture, 
            transparent: true,
            side: THREE.DoubleSide
        });
        
        const symbolGeometry = new THREE.PlaneGeometry(0.6, 0.6);
        const symbolMesh = new THREE.Mesh(symbolGeometry, symbolMaterial);
        symbolMesh.position.set(x, y, z);
        
        // Face the symbol outward from the cylinder
        symbolMesh.lookAt(x, y * 2, z * 2);
        
        // Keep text upright relative to the world (not the cylinder surface)
        // This ensures text is readable when it rotates to the top
        // Rotate symbols 270 degrees
        symbolMesh.rotation.z = Math.PI / 2;
        symbolMesh.rotation.x = -Math.PI / 2 + angle;
        
        dialGroup.add(symbolMesh);
    });
    
    // Position dial along the cryptex
    const spacing = 1.8;
    dialGroup.position.x = (index - (NUM_DIALS - 1) / 2) * spacing;
    
    return dialGroup;
}

// Create marker to indicate alignment
function createMarker() {
    const markerGroup = new THREE.Group();
    
    // Arrow shape pointing to the alignment
    const markerGeometry = new THREE.ConeGeometry(0.2, 0.6, 4);
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.y = 2.5;
    marker.rotation.z = Math.PI;
    markerGroup.add(marker);
    
    return markerGroup;
}

// Create the hidden key
function createKey() {
    const keyGroup = new THREE.Group();
    
    // Key shaft
    const shaftGeometry = new THREE.CylinderGeometry(0.1, 0.1, 2, 16);
    const keyMaterial = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        metalness: 0.9,
        roughness: 0.1,
        emissive: 0xffd700,
        emissiveIntensity: 0.5
    });
    const shaft = new THREE.Mesh(shaftGeometry, keyMaterial);
    shaft.rotation.z = Math.PI / 2;
    keyGroup.add(shaft);
    
    // Key head
    const headGeometry = new THREE.TorusGeometry(0.4, 0.1, 16, 32);
    const head = new THREE.Mesh(headGeometry, keyMaterial);
    head.position.x = -1.2;
    head.rotation.y = Math.PI / 2;
    keyGroup.add(head);
    
    // Key teeth
    for (let i = 0; i < 3; i++) {
        const toothGeometry = new THREE.BoxGeometry(0.15, 0.3, 0.08);
        const tooth = new THREE.Mesh(toothGeometry, keyMaterial);
        tooth.position.set(0.3 + i * 0.3, -0.15, 0);
        keyGroup.add(tooth);
    }
    
    keyGroup.position.set(0, 0, 0);
    keyGroup.scale.set(0, 0, 0);
    keyGroup.rotation.y = Math.PI / 4;
    
    return keyGroup;
}

// Build the cryptex
const body = createCryptexBody();
cryptex.add(body);

for (let i = 0; i < NUM_DIALS; i++) {
    const dial = createDial(i);
    dials.push(dial);
    cryptex.add(dial);
    
    // Set initial rotation based on random dial state
    const initialRotation = -(dialStates[i] * (Math.PI * 2) / SYMBOLS.length);
    dial.rotation.x = initialRotation;
}

const key = createKey();
scene.add(key);

// Rotate cryptex so notches face the viewer
cryptex.rotation.x = Math.PI / 2;
cryptex.rotation.y = (Math.PI * 3) / 2;

scene.add(cryptex);

// Mouse interaction
let isDragging = false;
let isMouseDown = false;
let previousMousePosition = { x: 0, y: 0 };
let mouseDownPosition = { x: 0, y: 0 };
let mouseDownTime = 0;
let lastDialClickTime = 0;
const DIAL_CLICK_COOLDOWN = 500; // milliseconds between dial clicks

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Add both mouse and touch event listeners
renderer.domElement.addEventListener('mousedown', onPointerDown);
renderer.domElement.addEventListener('mousemove', onPointerMove);
renderer.domElement.addEventListener('mouseup', onPointerUp);
renderer.domElement.addEventListener('touchstart', onPointerDown, { passive: false });
renderer.domElement.addEventListener('touchmove', onPointerMove, { passive: false });
renderer.domElement.addEventListener('touchend', onPointerUp);
renderer.domElement.addEventListener('touchcancel', onPointerUp);

// Unified pointer handler to get coordinates from mouse or touch
function getPointerPosition(event) {
    if (event.touches && event.touches.length > 0) {
        return { x: event.touches[0].clientX, y: event.touches[0].clientY };
    }
    return { x: event.clientX, y: event.clientY };
}

function onPointerDown(event) {
    if (isUnlocked) return;
    
    // Prevent default touch behavior
    if (event.touches) {
        event.preventDefault();
    }
    
    const pos = getPointerPosition(event);
    
    isMouseDown = true;
    isDragging = false;
    previousMousePosition = pos;
    mouseDownPosition = pos;
    mouseDownTime = Date.now();
}

function onPointerMove(event) {
    if (isUnlocked || !isMouseDown) return;
    
    // Prevent default touch behavior
    if (event.touches) {
        event.preventDefault();
    }
    
    const pos = getPointerPosition(event);
    const deltaX = pos.x - previousMousePosition.x;
    const deltaY = pos.y - previousMousePosition.y;
    
    // If mouse moves significantly, it's a drag
    if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
        isDragging = true;
        
        // Rotate entire cryptex
        cryptex.rotation.y += deltaX * 0.01;
        cryptex.rotation.x += deltaY * 0.01;
        
        previousMousePosition = pos;
    }
}

function onPointerUp(event) {
    if (isUnlocked) return;
    
    // Get position from touch or mouse
    const pos = event.changedTouches && event.changedTouches.length > 0 
        ? { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY }
        : { x: event.clientX, y: event.clientY };
    
    // Check if this was a click/tap (not a drag)
    const timeDiff = Date.now() - mouseDownTime;
    const distanceMoved = Math.sqrt(
        Math.pow(pos.x - mouseDownPosition.x, 2) + 
        Math.pow(pos.y - mouseDownPosition.y, 2)
    );
    
    // If pointer didn't move much and release was quick, treat it as a click/tap
    if (!isDragging && timeDiff < 300 && distanceMoved < 5) {
        // Check cooldown period
        const currentTime = Date.now();
        if (currentTime - lastDialClickTime < DIAL_CLICK_COOLDOWN) {
            isMouseDown = false;
            isDragging = false;
            return; // Ignore click if within cooldown period
        }
        
        mouse.x = (pos.x / window.innerWidth) * 2 - 1;
        mouse.y = -(pos.y / window.innerHeight) * 2 + 1;
        
        raycaster.setFromCamera(mouse, camera);
        
        // Check if clicking on a dial
        const dialMeshes = dials.map(d => d.children[0]);
        const intersects = raycaster.intersectObjects(dialMeshes);
        
        if (intersects.length > 0) {
            const dialMesh = intersects[0].object;
            const clickedDial = dialMesh.parent;
            const dialIndex = clickedDial.userData.index;
            
            // Rotate dial to next symbol
            dialStates[dialIndex] = (dialStates[dialIndex] + 1) % SYMBOLS.length;
            
            const targetRotation = -(dialStates[dialIndex] * (Math.PI * 2) / SYMBOLS.length);
            clickedDial.rotation.x = targetRotation;
            
            lastDialClickTime = currentTime; // Update last click time
            
            // Play click sound
            playClickSound();
            
            checkCode();
        }
    }
    
    isMouseDown = false;
    isDragging = false;
}

// Check if code is correct
function checkCode() {
    if (isUnlocked) return;
    
    const currentCode = dialStates.map(state => SYMBOLS[state]);
    const isCorrect = currentCode.every((symbol, index) => symbol === CORRECT_CODE[index]);
    
    if (isCorrect) {
        unlockCryptex();
    }
}

// Unlock animation
function unlockCryptex() {
    isUnlocked = true;
    
    // Play unlock sound
    playUnlockSound();
    
    // Show success message
    document.getElementById('success-message').classList.remove('hidden');
    
    // Animate cryptex opening - slide right end cap out
    const openAnimation = () => {
        // Find the right cap in the body group
        const bodyGroup = cryptex.children.find(child => child.type === 'Group' && child.children.length > 5);
        if (bodyGroup) {
            const rightCap = bodyGroup.children.find(child => child.position.x > 4);
            if (rightCap && rightCap.position.x < 6) {
                rightCap.position.x += 0.03;
            }
        }
        
        // Reveal key
        if (key.scale.x < 1.5) {
            key.scale.x += 0.02;
            key.scale.y += 0.02;
            key.scale.z += 0.02;
            key.rotation.y += 0.05;
        }
        
        // Continue animation until cap is fully extended
        const bodyGroup2 = cryptex.children.find(child => child.type === 'Group' && child.children.length > 5);
        if (bodyGroup2) {
            const rightCap2 = bodyGroup2.children.find(child => child.position.x > 4);
            if (rightCap2 && rightCap2.position.x < 6) {
                requestAnimationFrame(openAnimation);
            }
        }
    };
    
    setTimeout(openAnimation, 500);
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    // Key floating animation when revealed
    if (isUnlocked && key.scale.x >= 1.5) {
        key.position.y = Math.sin(Date.now() * 0.002) * 0.3;
        key.rotation.y += 0.01;
    }
    
    renderer.render(scene, camera);
}

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start animation
animate();

// Log the correct code for testing
// console.log('Correct code:', CORRECT_CODE);
