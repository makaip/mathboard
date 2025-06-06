const MQ = MathQuill.getInterface(2);

class MathBoard {
  constructor() {
    this.canvas = document.getElementById('canvas');

    this.mouseX = 0;
    this.mouseY = 0;

    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };
    this.canvasOffset = { x: 0, y: 0 };
    this.spaceDown = false;
    this.scale = 1;
    this.canvasInitialOffset = { x: -10000, y: -10000 };

    this.groupDragging = false;
    this.draggedGroup = null;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
    this.margin = 10;
    this.gridSize = 20; // Define the grid size for snapping

    this.isBoxSelecting = false;
    this.boxSelectStart = { x: 0, y: 0 };
    this.selectionBox = null;
    this.justBoxSelected = false;

    this.clipboard = null; // To store copied/cut group data

    this.fileManager = new FileManager(this);
    this.fileManager.loadState();

    this.initEventListeners();

    this.navigation = new Navigation(this);
    this.navigation.init();
  }

  initEventListeners() {
    this.initGlobalKeyHandlers();
    this.initDocumentClickHandler();
    this.initGroupDragging();
    this.initWindowResizeHandler();
    this.initDoubleClickHandler();
  }

  initGlobalKeyHandlers() {
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        this.spaceDown = true;
      }

      if (
        (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'x') &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.metaKey
      ) {
        const selectedGroups = document.querySelectorAll('.math-group.selected');
        if (selectedGroups.length > 0) {
          e.preventDefault();
          selectedGroups.forEach((group) => {
            group.remove();
          });
          // Save updated state
          this.fileManager.saveState();
        }
      }

      
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'c') {
          this.copySelectedGroups();
        } else if (e.key === 'x') {
          this.cutSelectedGroups();
        } else if (e.key === 'v') {
          this.pasteGroups();
        }
      }
      
      if (e.shiftKey && e.key === 'A' && !document.querySelector('.mq-focused')) {
        e.preventDefault();
        const coords = this.screenToCanvas(this.mouseX, this.mouseY);
        new MathGroup(this, coords.x, coords.y);
        this.fileManager.saveState();
      }
    });

    document.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.spaceDown = false;
      }
    });
  }

  initDocumentClickHandler() {
    document.addEventListener('click', (event) => {
      // If this click was triggered immediately after a box selection, skip clearing the selection.
      if (this.justBoxSelected) {
        this.justBoxSelected = false;
        return;
      }

      // If click target is inside an editable math field, handle it there.
      if (event.target.closest('.mq-editable-field')) {
        return;
      }

      // If clicking on a math-field container that is finalized:
      const mathContainer = event.target.closest('.math-field-container');
      if (mathContainer) {
        document.querySelectorAll('.math-group').forEach((group) => group.classList.remove('selected'));
        event.stopPropagation();
        MathField.edit(mathContainer);
        return;
      }

      // Remove container selection if clicking outside
      if (!event.target.closest('.math-field-container')) {
        document.querySelectorAll('.math-field-container.selected-field')
          .forEach(el => el.classList.remove('selected-field'));
      }

      // Otherwise, if clicking on a math group (stack), handle selection.
      const mathGroupTarget = event.target.closest('.math-group');
      if (mathGroupTarget) {
        if (!event.shiftKey) {
          document.querySelectorAll('.math-group').forEach((group) => group.classList.remove('selected'));
          mathGroupTarget.classList.add('selected');
        } else {
          mathGroupTarget.classList.toggle('selected');
        }
      } else {
        document.querySelectorAll('.math-group').forEach((group) => group.classList.remove('selected'));
      }
    });
  }

  initGroupDragging() {
    document.addEventListener('mousedown', (event) => {
      // Ignore if not left click, if space is down, or if clicking inside an editable field
      if (event.button !== 0 || this.spaceDown || event.target.closest('.mq-editable-field')) return;
      
      // Ignore clicks starting on the field drag handle
      if (event.target.closest('.drag-handle')) return;

      let target = event.target;
      while (target && !target.classList.contains('math-group')) {
        target = target.parentElement;
      }

      if (target && target.classList.contains('math-group')) {
        let groups;
        if (target.classList.contains('selected')) {
          groups = Array.from(document.querySelectorAll('.math-group.selected'));
        } else {
          groups = [target];
        }

        this.groupDragging = true;
        this.selectedGroups = groups;
        this.dragStart = { x: event.clientX, y: event.clientY };
        this.initialPositions = groups.map((group) => ({
          group: group,
          left: parseInt(group.style.left, 10),
          top: parseInt(group.style.top, 10)
        }));

        groups.forEach((group) => group.classList.add('dragging'));
        event.stopPropagation();
      }

      if (!target) {
        document.querySelectorAll('.math-group').forEach((group) => group.classList.remove('selected'));
      }
    });

    document.addEventListener('mousemove', (event) => {
      this.mouseX = event.clientX;
      this.mouseY = event.clientY;

      if (this.groupDragging && this.selectedGroups) {
        const deltaX = event.clientX - this.dragStart.x;
        const deltaY = event.clientY - this.dragStart.y;
        const snapToGrid = event.ctrlKey || event.metaKey; // Check for Ctrl/Cmd key

        this.initialPositions.forEach((item) => {
          let newLeft = item.left + deltaX;
          let newTop = item.top + deltaY;

          if (snapToGrid) {
            const canvasCoords = this.screenToCanvas(item.group.offsetLeft + deltaX, item.group.offsetTop + deltaY);
            const initialCanvasCoords = this.screenToCanvas(item.left, item.top);
            const canvasDeltaX = canvasCoords.x - initialCanvasCoords.x;
            const canvasDeltaY = canvasCoords.y - initialCanvasCoords.y;

            const snappedCanvasX = Math.round((initialCanvasCoords.x + canvasDeltaX) / this.gridSize) * this.gridSize;
            const snappedCanvasY = Math.round((initialCanvasCoords.y + canvasDeltaY) / this.gridSize) * this.gridSize;

            newLeft = Math.round(newLeft / this.gridSize) * this.gridSize;
            newTop = Math.round(newTop / this.gridSize) * this.gridSize;
          }

          item.group.style.left = newLeft + 'px';
          item.group.style.top = newTop + 'px';
        });
      }
    });

    document.addEventListener('mouseup', () => {
      if (this.groupDragging && this.selectedGroups) {
        this.selectedGroups.forEach((group) => group.classList.remove('dragging'));
        this.groupDragging = false;
        this.selectedGroups = null;
        this.initialPositions = null;
        this.fileManager.saveState();
      }
    });
  }

  initWindowResizeHandler() {
    window.addEventListener('resize', () => {
      this.updateTransform();
    });
  }

  initDoubleClickHandler() {
    document.addEventListener('dblclick', (event) => {
      if (event.target.closest('.math-group')) return;
      if (this.isPanning) return;
      const coords = this.screenToCanvas(event.clientX, event.clientY);
      new MathGroup(this, coords.x, coords.y);
      window.versionManager.saveState();
    });
  }

  updateTransform() {
    this.canvas.style.transform = `translate(${this.canvasOffset.x}px, ${this.canvasOffset.y}px)`;
  }

  screenToCanvas(x, y) {
    return {
      x: (x - (this.canvasInitialOffset.x + this.canvasOffset.x)) / this.scale,
      y: (y - (this.canvasInitialOffset.y + this.canvasOffset.y)) / this.scale,
    };
  }

  copySelectedGroups() {
    const selectedGroups = Array.from(document.querySelectorAll('.math-group.selected'));
    if (selectedGroups.length === 0) {
      this.clipboard = null;
      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    selectedGroups.forEach(group => {
      const left = parseInt(group.style.left, 10);
      const top = parseInt(group.style.top, 10);
      if (left < minX) minX = left;
      if (top < minY) minY = top;
    });

    this.clipboard = selectedGroups.map(group => {
      const left = parseInt(group.style.left, 10);
      const top = parseInt(group.style.top, 10);
      const fields = [];
      group.querySelectorAll('.math-field-container').forEach(container => {
        if (container.dataset.latex) {
          fields.push(container.dataset.latex);
        }
      });
      return { relativeLeft: left - minX, relativeTop: top - minY, fields };
    });
  }

  cutSelectedGroups() {
    this.copySelectedGroups();
    if (!this.clipboard) return;

    const selectedGroups = document.querySelectorAll('.math-group.selected');
    selectedGroups.forEach(group => group.remove());

    window.versionManager.saveState();
  }

  pasteGroups() {
    if (!this.clipboard) return;

    document.querySelectorAll('.math-group.selected').forEach(group => group.classList.remove('selected'));

    const pasteCenterCoords = this.screenToCanvas(this.mouseX, this.mouseY);
    const pasteBaseX = pasteCenterCoords.x;
    const pasteBaseY = pasteCenterCoords.y;

    const pastedGroups = [];
    this.clipboard.forEach(groupData => {
      const newLeft = pasteBaseX + groupData.relativeLeft;
      const newTop = pasteBaseY + groupData.relativeTop;
      const data = {
        left: `${newLeft}px`,
        top: `${newTop}px`,
        fields: groupData.fields
      };
      const newGroupInstance = new MathGroup(this, 0, 0, data);
      pastedGroups.push(newGroupInstance.element);
    });

    pastedGroups.forEach(groupEl => groupEl.classList.add('selected'));

    window.versionManager.saveState();
  }
}

