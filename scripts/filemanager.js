// scripts/filemanager.js
class FileManager {
    constructor(board) {
      this.board = board;
    }
  
    saveState() {
      const groups = [];
      const mathGroupElements = this.board.canvas.querySelectorAll('.math-group');
      mathGroupElements.forEach((group) => {
        const left = group.style.left;
        const top = group.style.top;
        const fields = [];
        group.querySelectorAll('.math-field-container').forEach((container) => {
          if (container.dataset.latex) {
            fields.push(container.dataset.latex);
          }
        });
        groups.push({ left, top, fields });
      });
      const stateString = JSON.stringify(groups);
      localStorage.setItem("mathBoardState", stateString);
    }
  
    loadState() {
      const stateString = localStorage.getItem("mathBoardState");
      if (!stateString) return;
      let groups;
      try {
        groups = JSON.parse(stateString);
      } catch (e) {
        console.error("Failed to parse state from localStorage:", e);
        return;
      }
      groups.forEach((groupData) => {
        new MathGroup(this.board, groupData.left, groupData.top, groupData);
      });
    }
  
    exportData() {
      const groups = [];
      const mathGroupElements = this.board.canvas.querySelectorAll('.math-group');
      mathGroupElements.forEach((group) => {
        const left = group.style.left;
        const top = group.style.top;
        const fields = [];
        group.querySelectorAll('.math-field-container').forEach((container) => {
          if (container.dataset.latex) {
            fields.push(container.dataset.latex);
          }
        });
        groups.push({ left, top, fields });
      });
      const dataStr = JSON.stringify(groups, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = "mathboard-data.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  
    importData(jsonData) {
      try {
        const groups = JSON.parse(jsonData);
        // Clear the current canvas (remove all existing math groups).
        this.board.canvas.innerHTML = '';
        groups.forEach((groupData) => {
           new MathGroup(this.board, groupData.left, groupData.top, groupData);
        });
        // Save the new state.
        this.saveState();
      } catch (error) {
        console.error("Failed to import data:", error);
      }
    }
  }
  