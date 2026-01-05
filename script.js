// --- 1. 布局定义 ---

const cell = (r, c, w = 1, h = 1) => ({ r, c, w, h });

const layouts = {
    classic: {
        cols: 7, rows: 6, maxPhotos: 27,
        cells: [
            cell(1,2), cell(1,3), cell(1,5), cell(1,6),
            cell(2,1), cell(2,2), cell(2,3), cell(2,4), cell(2,5), cell(2,6), cell(2,7),
            cell(3,1), cell(3,2), cell(3,3), cell(3,4), cell(3,5), cell(3,6), cell(3,7),
            cell(4,2), cell(4,3), cell(4,4), cell(4,5), cell(4,6),
            cell(5,3), cell(5,4), cell(5,5),
            cell(6,4)
        ]
    },
    dense: {
        cols: 9, rows: 8, maxPhotos: 55,
        cells: [
            cell(1,2), cell(1,3), cell(1,7), cell(1,8),
            cell(2,1), cell(2,2), cell(2,3), cell(2,4), cell(2,6), cell(2,7), cell(2,8), cell(2,9),
            cell(3,1), cell(3,2), cell(3,3), cell(3,4), cell(3,5), cell(3,6), cell(3,7), cell(3,8), cell(3,9),
            cell(4,1), cell(4,2), cell(4,3), cell(4,4), cell(4,5), cell(4,6), cell(4,7), cell(4,8), cell(4,9),
            cell(5,2), cell(5,3), cell(5,4), cell(5,5), cell(5,6), cell(5,7), cell(5,8),
            cell(6,3), cell(6,4), cell(6,5), cell(6,6), cell(6,7),
            cell(7,4), cell(7,5), cell(7,6),
            cell(8,5)
        ]
    },
    artistic: {
        cols: 7, rows: 6, maxPhotos: 17,
        cells: [
            cell(1,2), cell(1,3), cell(1,5), cell(1,6),
            cell(2,1, 1, 2), cell(2,2),
            cell(2,3, 3, 3), // C位大图
            cell(2,6), cell(2,7, 1, 2),
            cell(3,2), cell(3,6),
            cell(4,2), cell(4,6),
            cell(5,3), cell(5,4), cell(5,5),
            cell(6,4)
        ]
    }
};

// --- 2. 状态管理 ---

let currentLayoutKey = 'classic';
let photos = [];
let modalAction = null;
let draggedIndex = null; // 拖拽源索引

// 移动端触摸拖拽状态
let touchDragState = {
    longPressTimer: null,
    isDraggingTouch: false,
    startX: 0,
    startY: 0,
    currentElement: null,
    draggedElement: null,
    longPressTriggered: false,
    hasMoved: false
};

// 图片预览状态
let previewState = {
    currentIndex: null
};

const gridEl = document.getElementById('heartGrid');
const countDisplay = document.getElementById('countDisplay');
const maxDisplay = document.getElementById('maxDisplay');
const exportBtn = document.getElementById('exportBtn');

// --- 3. 核心逻辑 ---

function init() {
    createStars();
    initFireworks();
    switchLayout('classic');
    updateExportBtnState();
}

function createStars() {
    const container = document.getElementById('starsContainer');
    const starCount = 100;
    container.innerHTML = '';

    for (let i = 0; i < starCount; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        const x = Math.random() * 100;
        const y = Math.random() * 100;
        const size = Math.random() * 2 + 1;
        const duration = Math.random() * 3 + 2;
        const opacity = Math.random();

        star.style.left = `${x}%`;
        star.style.top = `${y}%`;
        star.style.width = `${size}px`;
        star.style.height = `${size}px`;
        star.style.setProperty('--duration', `${duration}s`);
        star.style.setProperty('--opacity', opacity);

        container.appendChild(star);
    }
}

function switchLayout(key) {
    currentLayoutKey = key;
    const layout = layouts[key];

    document.querySelectorAll('.layout-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`btn-${key}`).classList.add('active');

    gridEl.style.gridTemplateColumns = `repeat(${layout.cols}, 1fr)`;
    renderGrid(layout);
}

function renderGrid(layout) {
    gridEl.innerHTML = '';
    maxDisplay.innerText = layout.maxPhotos;

    layout.cells.forEach((cellDef, index) => {
        const div = document.createElement('div');
        div.className = 'grid-item group';
        
        div.style.gridColumnStart = cellDef.c;
        div.style.gridRowStart = cellDef.r;
        div.style.gridColumnEnd = `span ${cellDef.w}`;
        div.style.gridRowEnd = `span ${cellDef.h}`;
        
        // 关键修复：
        // 对于 1x1 单元格，我们强制使用 aspect-ratio: 1/1 来支撑行高
        // 对于跨行/跨列单元格，我们不设置 aspect-ratio，也不设置固定 height
        // 它们会自动填充由 1x1 单元格撑开的网格区域
        if (cellDef.w === 1 && cellDef.h === 1) {
            div.style.aspectRatio = '1 / 1';
        } else {
            div.style.height = '100%'; // 确保填充网格区域
        }

        div.dataset.index = index;
        // PC端：空格子点击上传，有图片点击预览
        div.onclick = () => {
            if (photos[index]) {
                openImagePreview(index);
            } else {
                triggerSingleUpload(index);
            }
        };

        renderSlotContent(div, index, cellDef);
        gridEl.appendChild(div);
    });

    updateCount();
}

function renderSlotContent(element, index, cellDef) {
    element.innerHTML = '';
    
    if (photos[index]) {
        // 有图片的单元格：显示图片 + 拖拽手柄（PC端）
        element.draggable = false; // 容器本身不拖拽，避免和点击上传冲突
        element.classList.add('draggable-item');
        
        const img = document.createElement('img');
        img.src = photos[index];
        img.className = 'image-loaded';
        img.draggable = false; // 防止图片本身被拖拽

        // 拖拽手柄（右下角小图标）- 仅PC端使用
        const dragHandle = document.createElement('div');
        dragHandle.className = 'drag-handle';
        dragHandle.innerHTML = '<i class="fas fa-arrows-alt"></i>';
        dragHandle.draggable = true; // 只有手柄可拖拽
        // 阻止点击手柄触发预览
        dragHandle.addEventListener('click', (e) => e.stopPropagation());
        dragHandle.addEventListener('mousedown', (e) => e.stopPropagation());
        // 绑定拖拽事件（源索引从最近的 grid-item 读取）
        dragHandle.addEventListener('dragstart', handleDragStart);
        dragHandle.addEventListener('dragend', handleDragEnd);

        element.appendChild(img);
        element.appendChild(dragHandle);
        
        // 为移动端添加触摸事件监听
        element.addEventListener('touchstart', handleTouchStart, { passive: false });
        element.addEventListener('touchmove', handleTouchMove, { passive: false });
        element.addEventListener('touchend', handleTouchEnd, { passive: false });
        element.addEventListener('touchcancel', handleTouchCancel, { passive: false });
    } else {
        // 空单元格：不可拖拽，但可作为放置目标
        element.draggable = false;
        element.classList.remove('draggable-item');
        
        const placeholder = document.createElement('div');
        placeholder.className = 'empty-placeholder';
        
        const isLarge = cellDef.w > 1 || cellDef.h > 1;
        const iconSize = isLarge ? 'icon-size-lg' : 'icon-size-sm';
        const text = isLarge ? (cellDef.w > 1 && cellDef.h > 1 ? 'C位' : '大图') : '';

        placeholder.innerHTML = `
            <i class="fas fa-plus ${iconSize} opacity-30 mb-1"></i>
            ${text ? `<span class="text-xs opacity-50 scale-75">${text}</span>` : ''}
        `;
        element.appendChild(placeholder);
    }
    
    // 所有单元格都可以作为放置目标
    element.addEventListener('dragover', handleDragOver);
    element.addEventListener('drop', handleDrop);
    element.addEventListener('dragenter', handleDragEnter);
    element.addEventListener('dragleave', handleDragLeave);
}

// --- 4. 交互逻辑 ---

const fileInput = document.getElementById('fileInput');

fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
    fileInput.value = '';
});

function handleFiles(files) {
    if (!files.length) return;
    const layout = layouts[currentLayoutKey];
    const max = layout.maxPhotos;
    
    let emptyIndices = [];
    for (let i = 0; i < max; i++) {
        if (!photos[i]) emptyIndices.push(i);
    }

    Array.from(files).forEach((file, i) => {
        if (i < emptyIndices.length) {
            readAndSetPhoto(file, emptyIndices[i]);
        }
    });
    
    launchRocket();
    setTimeout(launchRocket, 300);
    showToast('照片上传成功');
}

function readAndSetPhoto(file, index) {
    const reader = new FileReader();
    reader.onload = (e) => {
        photos[index] = e.target.result;
        refreshSlot(index);
        updateCount();
    };
    reader.readAsDataURL(file);
}

function triggerSingleUpload(index) {
    const tempInput = document.createElement('input');
    tempInput.type = 'file';
    tempInput.accept = 'image/*';
    tempInput.onchange = (e) => {
        if (e.target.files[0]) {
            readAndSetPhoto(e.target.files[0], index);
        }
    };
    tempInput.click();
}

function removePhoto(index) {
    photos[index] = null;
    refreshSlot(index);
    updateCount();
}

function refreshSlot(index) {
    const layout = layouts[currentLayoutKey];
    const slots = gridEl.children;
    if (slots[index]) {
        renderSlotContent(slots[index], index, layout.cells[index]);
    }
}

// --- 拖拽功能 ---

function handleDragStart(e) {
    // 从最近的 grid-item 上读取索引，保证手柄 / 子元素都可用
    const gridItem = e.target.closest('.grid-item');
    if (!gridItem) return;
    const index = parseInt(gridItem.dataset.index);
    if (photos[index]) {
        draggedIndex = index;
        gridItem.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', index);
    }
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    // 清除所有拖拽相关的样式
    document.querySelectorAll('.grid-item').forEach(item => {
        item.classList.remove('drag-over');
    });
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
    e.preventDefault();
    const target = e.currentTarget;
    const targetIndex = parseInt(target.dataset.index);
    // 如果目标位置与源位置不同，添加视觉反馈
    if (targetIndex !== draggedIndex && draggedIndex !== null) {
        target.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    const target = e.currentTarget;
    // 只有当离开整个元素时才移除样式
    if (!target.contains(e.relatedTarget)) {
        target.classList.remove('drag-over');
    }
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const target = e.currentTarget;
    const targetIndex = parseInt(target.dataset.index);
    
    // 清除拖拽样式
    target.classList.remove('drag-over');
    document.querySelectorAll('.grid-item').forEach(item => {
        item.classList.remove('drag-over');
    });
    
    // 如果源索引和目标索引都有效且不同，则交换图片
    if (draggedIndex !== null && targetIndex !== draggedIndex) {
        swapPhotos(draggedIndex, targetIndex);
    }
    
    draggedIndex = null;
}

function swapPhotos(sourceIndex, targetIndex) {
    // 交换两个位置的图片
    const temp = photos[sourceIndex];
    photos[sourceIndex] = photos[targetIndex] || null;
    photos[targetIndex] = temp || null;
    
    // 刷新两个槽位
    const layout = layouts[currentLayoutKey];
    refreshSlot(sourceIndex);
    refreshSlot(targetIndex);
    
    // 更新计数
    updateCount();
    
    // 显示提示
    showToast('图片位置已调整');
}

// --- 移动端触摸拖拽功能 ---

function handleTouchStart(e) {
    const gridItem = e.currentTarget.closest('.grid-item');
    if (!gridItem) return;
    
    const index = parseInt(gridItem.dataset.index);
    if (!photos[index]) return;
    
    // 阻止默认行为（禁用长按菜单等）
    e.preventDefault();
    
    const touch = e.touches[0];
    touchDragState.startX = touch.clientX;
    touchDragState.startY = touch.clientY;
    touchDragState.currentElement = gridItem;
    touchDragState.longPressTriggered = false;
    touchDragState.hasMoved = false;
    
    // 启动长按计时器（500ms）
    touchDragState.longPressTimer = setTimeout(() => {
        // 长按时间到达，进入可拖拽状态
        touchDragState.longPressTriggered = true;
        draggedIndex = index;
        gridItem.classList.add('long-press-active');
        
        // 震动反馈（如果设备支持）
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }
        
        showToast('可以拖拽了！');
    }, 500);
}

function handleTouchMove(e) {
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchDragState.startX);
    const deltaY = Math.abs(touch.clientY - touchDragState.startY);
    
    // 记录是否移动过
    if (deltaX > 10 || deltaY > 10) {
        touchDragState.hasMoved = true;
    }
    
    if (!touchDragState.longPressTriggered) {
        // 如果还没到长按时间，移动超过一定距离就取消长按
        if (touchDragState.hasMoved) {
            clearTimeout(touchDragState.longPressTimer);
        }
        return;
    }
    
    // 已进入拖拽状态
    e.preventDefault();
    
    // 添加拖拽样式
    if (touchDragState.currentElement && !touchDragState.isDraggingTouch) {
        touchDragState.currentElement.classList.remove('long-press-active');
        touchDragState.currentElement.classList.add('touch-dragging');
        touchDragState.isDraggingTouch = true;
    }
    
    // 检测当前触摸点下的元素
    const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    const targetGridItem = elementBelow?.closest('.grid-item');
    
    // 清除之前的 drag-over 样式
    document.querySelectorAll('.grid-item').forEach(item => {
        if (item !== touchDragState.currentElement) {
            item.classList.remove('drag-over');
        }
    });
    
    // 如果悬停在其他格子上，添加 drag-over 样式
    if (targetGridItem && targetGridItem !== touchDragState.currentElement) {
        targetGridItem.classList.add('drag-over');
    }
}

function handleTouchEnd(e) {
    // 清除长按计时器
    clearTimeout(touchDragState.longPressTimer);
    
    if (!touchDragState.longPressTriggered) {
        // 没有触发长按，判断是否是点击（未移动）
        if (!touchDragState.hasMoved && touchDragState.currentElement) {
            const index = parseInt(touchDragState.currentElement.dataset.index);
            if (photos[index]) {
                // 打开图片预览
                openImagePreview(index);
            }
        }
        touchDragState.currentElement = null;
        touchDragState.hasMoved = false;
        return;
    }
    
    e.preventDefault();
    
    // 获取结束位置的元素
    const touch = e.changedTouches[0];
    const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    const targetGridItem = elementBelow?.closest('.grid-item');
    
    // 清除所有拖拽样式
    if (touchDragState.currentElement) {
        touchDragState.currentElement.classList.remove('long-press-active', 'touch-dragging');
    }
    document.querySelectorAll('.grid-item').forEach(item => {
        item.classList.remove('drag-over');
    });
    
    // 如果有效的放置目标，执行交换
    if (targetGridItem && targetGridItem !== touchDragState.currentElement && draggedIndex !== null) {
        const targetIndex = parseInt(targetGridItem.dataset.index);
        if (targetIndex !== draggedIndex) {
            swapPhotos(draggedIndex, targetIndex);
        }
    }
    
    // 重置状态
    touchDragState.isDraggingTouch = false;
    touchDragState.currentElement = null;
    touchDragState.longPressTriggered = false;
    draggedIndex = null;
}

function handleTouchCancel(e) {
    // 触摸被打断（如来电等），清理状态
    clearTimeout(touchDragState.longPressTimer);
    
    if (touchDragState.currentElement) {
        touchDragState.currentElement.classList.remove('long-press-active', 'touch-dragging');
    }
    document.querySelectorAll('.grid-item').forEach(item => {
        item.classList.remove('drag-over');
    });
    
    touchDragState.isDraggingTouch = false;
    touchDragState.currentElement = null;
    touchDragState.longPressTriggered = false;
    draggedIndex = null;
}

// --- 模态框逻辑 ---
function showModal(type) {
    const titleEl = document.getElementById('modalTitle');
    const descEl = document.getElementById('modalDesc');
    const confirmBtn = document.getElementById('modalConfirmBtn');
    
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);

    if (type === 'reset') {
        titleEl.innerText = "确认清空？";
        descEl.innerText = "所有已上传的照片将被移除且无法恢复。";
        newBtn.innerText = "确认清空";
        newBtn.onclick = () => {
            confirmReset();
            closeModal();
        };
    } else if (type === 'incomplete') {
        titleEl.innerText = "照片未填满";
        descEl.innerText = "爱心墙还有空位哦，可能会影响美观，确定要现在导出吗？";
        newBtn.innerText = "继续导出";
        newBtn.onclick = () => {
            executeExport();
            closeModal();
        };
    }
    
    document.getElementById('confirmModal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('confirmModal').classList.add('hidden');
}

function confirmReset() {
    photos = [];
    renderGrid(layouts[currentLayoutKey]);
    showToast('已清空所有照片');
}

// --- 导出逻辑 ---
function updateExportBtnState() {
    const layout = layouts[currentLayoutKey];
    let count = 0;
    for(let i=0; i<layout.maxPhotos; i++) {
        if(photos[i]) count++;
    }
    
    if (count === 0) {
        exportBtn.disabled = true;
        exportBtn.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
        exportBtn.disabled = false;
        exportBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
}

function tryExport() {
    const layout = layouts[currentLayoutKey];
    let count = 0;
    for(let i=0; i<layout.maxPhotos; i++) {
        if(photos[i]) count++;
    }
    
    if (count < layout.maxPhotos) {
        showModal('incomplete');
    } else {
        executeExport();
    }
}

async function executeExport() {
    const element = document.getElementById('captureArea');
    const watermark = document.getElementById('watermark');
    const btn = document.getElementById('exportBtn');
    
    if (!element || !window.htmlToImage) {
        console.error('导出失败：找不到导出容器或 html-to-image 未加载');
        alert('导出失败，请稍后重试');
        return;
    }

    watermark.classList.remove('hidden');
    element.classList.add('exporting');
    
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 生成中...';
    btn.disabled = true;

    try {
        // 使用当前容器的实际尺寸，避免变形
        const width = element.clientWidth;
        const height = element.clientHeight;
        // 提升清晰度：根据设备像素比设置更高的像素比例，最多 *3
        const deviceRatio = window.devicePixelRatio || 1;
        const pixelRatio = Math.min(deviceRatio * 1, 1.5);

        const dataUrl = await htmlToImage.toPng(element, {
            pixelRatio,
            cacheBust: true,
            width,
            height,
            // 在导出时禁用动画/滤镜，减少与视觉差异
            style: {
                transform: 'none',
                filter: 'none',
                animation: 'none'
            }
        });

        try {
            const link = document.createElement('a');
            link.download = `Starry_Heart_Wall_${Date.now()}.png`;
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            showToast('图片已开始下载');
            for (let i = 0; i < 5; i++) {
                setTimeout(launchRocket, i * 300);
            }
        } catch (e) {
            console.error("Download fail", e);
            alert("下载触发失败，请长按图片保存");
        }
    } catch (err) {
        console.error("Export Error:", err);
        btn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> 导出失败';
        setTimeout(() => { btn.innerHTML = originalText; }, 3000);
    } finally {
        watermark.classList.add('hidden');
        element.classList.remove('exporting');
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function updateCount() {
    const layout = layouts[currentLayoutKey];
    let count = 0;
    for(let i=0; i<layout.maxPhotos; i++) {
        if(photos[i]) count++;
    }
    countDisplay.innerText = count;
    updateExportBtnState();
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.innerHTML = `<i class="fas fa-check-circle text-green-500 mr-2"></i> <span>${msg}</span>`;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// --- 5. 烟花特效 ---
const canvas = document.getElementById('fireworksCanvas');
const ctx = canvas.getContext('2d');

let particles = [];
let rockets = [];

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const colors = [
    '#ff0040', '#ff0080', '#ff00bf', '#bf00ff', '#8000ff',
    '#4000ff', '#00ffff', '#ffffff', '#ffe600', '#ff8000'
];

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        const angle = Math.random() * Math.PI * 2;
        const velocity = Math.random() * 8 + 2; 
        this.vx = Math.cos(angle) * velocity;
        this.vy = Math.sin(angle) * velocity;
        
        this.alpha = 1.0;
        this.decay = Math.random() * 0.01 + 0.005; 
        this.gravity = 0.08; 
        this.friction = 0.97;
    }
    update() {
        this.vx *= this.friction;
        this.vy *= this.friction;
        this.vy += this.gravity;
        this.x += this.vx;
        this.y += this.vy;
        this.alpha -= this.decay;
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.alpha);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
        ctx.fill();
        if(Math.random() < 0.2 && this.alpha > 0.5) {
            ctx.fillStyle = "#fff";
            ctx.beginPath();
            ctx.arc(this.x, this.y, 1, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}

class Rocket {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = canvas.height;
        this.targetY = Math.random() * (canvas.height * 0.5) + (canvas.height * 0.1); 
        this.color = colors[Math.floor(Math.random() * colors.length)];
        this.speed = Math.random() * 5 + 6; 
        this.trail = [];
    }
    
    update() {
        this.y -= this.speed;
        this.trail.push({x: this.x, y: this.y});
        if (this.trail.length > 10) this.trail.shift();
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.fillStyle = this.color;
        ctx.arc(this.x, this.y, 3, 0, Math.PI*2);
        ctx.fill();

        ctx.beginPath();
        if (this.trail.length > 0) {
            ctx.moveTo(this.trail[0].x, this.trail[0].y);
            for (let p of this.trail) {
                ctx.lineTo(p.x, p.y);
            }
        }
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }
}

function explode(x, y, color) {
    const particleCount = 80;
    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle(x, y, color));
    }
    if (Math.random() < 0.4) {
         setTimeout(() => {
             for (let i = 0; i < 40; i++) {
                particles.push(new Particle(x, y, '#fff'));
            }
         }, 100);
    }
}

function launchRocket() {
    rockets.push(new Rocket());
}

function animateFireworks() {
    // 先淡出上一帧内容，避免残影永久留下
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 如果此刻没有粒子也没有火箭，直接清空画布，彻底抹除痕迹
    if (particles.length === 0 && rockets.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    ctx.globalCompositeOperation = 'lighter'; 

    for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.update();
        r.draw();

        if (r.y <= r.targetY) {
            explode(r.x, r.y, r.color);
            rockets.splice(i, 1);
        }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.update();
        p.draw();
        if (p.alpha <= 0) particles.splice(i, 1);
    }

    requestAnimationFrame(animateFireworks);
}

document.body.addEventListener('click', (e) => {
    if(e.target.closest('button') || e.target.closest('.heart-grid-container') || e.target.closest('#confirmModal')) return;
    
    const r = new Rocket();
    r.x = e.clientX; 
    r.y = canvas.height;
    r.targetY = e.clientY;
    rockets.push(r);
});

setInterval(() => {
    if (Math.random() < 0.08) launchRocket();
}, 300);

function initFireworks() {
    animateFireworks();
}

// --- 图片预览功能 ---

function openImagePreview(index) {
    previewState.currentIndex = index;
    const modal = document.getElementById('imagePreviewModal');
    const previewImg = document.getElementById('previewImage');
    
    previewImg.src = photos[index];
    modal.classList.remove('hidden');
    
    // 禁用背景滚动
    document.body.style.overflow = 'hidden';
}

function closeImagePreview() {
    const modal = document.getElementById('imagePreviewModal');
    modal.classList.add('hidden');
    previewState.currentIndex = null;
    
    // 恢复背景滚动
    document.body.style.overflow = '';
}

function deleteFromPreview() {
    if (previewState.currentIndex !== null) {
        const index = previewState.currentIndex;
        removePhoto(index);
        closeImagePreview();
        showToast('图片已删除');
    }
}

function replaceFromPreview() {
    if (previewState.currentIndex !== null) {
        const index = previewState.currentIndex;
        closeImagePreview();
        triggerSingleUpload(index);
    }
}

// 点击背景关闭预览
document.addEventListener('click', (e) => {
    const modal = document.getElementById('imagePreviewModal');
    if (e.target === modal) {
        closeImagePreview();
    }
});

// ESC 键关闭预览
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modal = document.getElementById('imagePreviewModal');
        if (!modal.classList.contains('hidden')) {
            closeImagePreview();
        }
    }
});

// 禁用移动端长按菜单（contextmenu）
document.addEventListener('contextmenu', (e) => {
    // 如果是在图片网格区域，禁用右键菜单
    if (e.target.closest('.grid-item')) {
        e.preventDefault();
    }
});

// 确保 DOM 加载完成后再初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

