JSONEditor.defaults.editors.table = JSONEditor.defaults.editors.array.extend({
  register: function() {
    this._super();
    if(this.rows) {
      for(var i=0; i<this.rows.length; i++) {
        this.rows[i].register();
      }
    }
  },
  unregister: function() {
    this._super();
    if(this.rows) {
      for(var i=0; i<this.rows.length; i++) {
        this.rows[i].unregister();
      }
    }
  },
  getNumColumns: function() {
    return Math.max(Math.min(12,this.width),3);
  },
  preBuild: function() {
    var item_schema = this.jsoneditor.expandRefs(this.schema.items || {});

    this.item_title = item_schema.title || 'row';
    this.item_default = item_schema["default"] || null;
    this.item_has_child_editors = item_schema.properties || item_schema.items;
    this.width = 12;
    this._super();
  },
  build: function() {
    var self = this;
    this.table = this.theme.getTable();
    JSONEditor.domMethods.appendChild(this.container, this.table);
    this.thead = this.theme.getTableHead();
    JSONEditor.domMethods.appendChild(this.table, this.thead);
    this.header_row = this.theme.getTableRow();
    JSONEditor.domMethods.appendChild(this.thead, this.header_row);
    this.row_holder = this.theme.getTableBody();
    JSONEditor.domMethods.appendChild(this.table, this.row_holder);

    // Determine the default value of array element
    var tmp = this.getElementEditor(0,true);
    this.item_default = tmp.getDefault();
    this.width = tmp.getNumColumns() + 2;
    
    if(!this.options.compact) {
      this.title = this.theme.getHeader(this.getTitle());
      JSONEditor.domMethods.appendChild(this.container, this.title);
      this.title_controls = this.theme.getHeaderButtonHolder();
      JSONEditor.domMethods.appendChild(this.title, this.title_controls);
      if(this.schema.description) {
        this.description = this.theme.getDescription(this.schema.description);
        JSONEditor.domMethods.appendChild(this.container, this.description);
      }
      this.panel = this.theme.getIndentedPanel();
      JSONEditor.domMethods.appendChild(this.container, this.panel);
      this.error_holder = document.createElement('div');
      JSONEditor.domMethods.appendChild(this.panel, this.error_holder);
    }
    else {
      this.panel = document.createElement('div');
      JSONEditor.domMethods.appendChild(this.container, this.panel);
    }

    JSONEditor.domMethods.appendChild(this.panel, this.table);
    this.controls = this.theme.getButtonHolder();
    JSONEditor.domMethods.appendChild(this.panel, this.controls);

    if(this.item_has_child_editors) {
      var ce = tmp.getChildEditors();
      var order = tmp.property_order || Object.keys(ce);
      for(var i=0; i<order.length; i++) {
        var th = self.theme.getTableHeaderCell(ce[order[i]].getTitle());
        if(ce[order[i]].options.hidden) th.style.display = 'none';
        JSONEditor.domMethods.appendChild(self.header_row, th);
      }
    }
    else {
      JSONEditor.domMethods.appendChild(self.header_row, self.theme.getTableHeaderCell(this.item_title));
    }

    tmp.destroy();
    this.row_holder.innerHTML = '';

    // Row Controls column
    this.controls_header_cell = self.theme.getTableHeaderCell(" ");
    JSONEditor.domMethods.appendChild(self.header_row, this.controls_header_cell);

    // Add controls
    this.addControls();
  },
  onChildEditorChange: function(editor) {
    this.refreshValue();
    this._super();
  },
  getItemDefault: function() {
    return $extend({},{"default":this.item_default})["default"];
  },
  getItemTitle: function() {
    return this.item_title;
  },
  getElementEditor: function(i,ignore) {
    var schema_copy = $extend({},this.schema.items);
    var editor = this.jsoneditor.getEditorClass(schema_copy, this.jsoneditor);
    var row = JSONEditor.domMethods.appendChild(this.row_holder, this.theme.getTableRow());
    var holder = row;
    if(!this.item_has_child_editors) {
      holder = this.theme.getTableCell();
      JSONEditor.domMethods.appendChild(row, holder);
    }

    var ret = this.jsoneditor.createEditor(editor,{
      jsoneditor: this.jsoneditor,
      schema: schema_copy,
      container: holder,
      path: this.path+'.'+i,
      parent: this,
      compact: true,
      table_row: true
    });
    
    ret.preBuild();
    if(!ignore) {
      ret.build();
      ret.postBuild();

      ret.controls_cell = JSONEditor.domMethods.appendChild(row, this.theme.getTableCell());
      ret.row = row;
      ret.table_controls = this.theme.getButtonHolder();
      JSONEditor.domMethods.appendChild(ret.controls_cell, ret.table_controls);
      ret.table_controls.style.margin = 0;
      ret.table_controls.style.padding = 0;
    }
    
    return ret;
  },
  destroy: function() {
    this.innerHTML = '';
    if(this.title && this.title.parentNode) {
      JSONEditor.domMethods.removeChild(this.title.parentNode, this.title);
    }
    if(this.description && this.description.parentNode) {
      JSONEditor.domMethods.removeChild(this.description.parentNode, this.description);
    }
    if(this.row_holder && this.row_holder.parentNode) {
      JSONEditor.domMethods.removeChild(this.row_holder.parentNode, this.row_holder);
    }
    if(this.table && this.table.parentNode) {
      JSONEditor.domMethods.removeChild(this.table.parentNode, this.table);
    }
    if(this.panel && this.panel.parentNode) {
      JSONEditor.domMethods.removeChild(this.panel.parentNode, this.panel);
    }

    this.rows = this.title = this.description = this.row_holder = this.table = this.panel = null;

    this._super();
  },
  setValue: function(value, initial) {
    // Update the array's value, adding/removing rows when necessary
    value = value || [];

    // Make sure value has between minItems and maxItems items in it
    if(this.schema.minItems) {
      while(value.length < this.schema.minItems) {
        value.push(this.getItemDefault());
      }
    }
    if(this.schema.maxItems && value.length > this.schema.maxItems) {
      value = value.slice(0,this.schema.maxItems);
    }
    
    var serialized = JSON.stringify(value);
    if(serialized === this.serialized) return;

    var numrows_changed = false;

    var self = this;
    $each(value,function(i,val) {
      if(self.rows[i]) {
        // TODO: don't set the row's value if it hasn't changed
        self.rows[i].setValue(val);
      }
      else {
        self.addRow(val);
        numrows_changed = true;
      }
    });

    for(var j=value.length; j<self.rows.length; j++) {
      var holder = self.rows[j].container;
      if(!self.item_has_child_editors) {
        JSONEditor.domMethods.removeChild(self.rows[j].row.parentNode, self.rows[j].row);
      }
      self.rows[j].destroy();
      if(holder.parentNode) {
        JSONEditor.domMethods.removeChild(holder.parentNode, holder);
      }
      self.rows[j] = null;
      numrows_changed = true;
    }
    self.rows = self.rows.slice(0,value.length);

    self.refreshValue();
    if(numrows_changed || initial) self.refreshRowButtons();

    self.onChange();
          
    // TODO: sortable
  },
  refreshRowButtons: function() {
    var self = this;
    
    // If we currently have minItems items in the array
    var minItems = this.schema.minItems && this.schema.minItems >= this.rows.length;
    
    var need_row_buttons = false;
    $each(this.rows,function(i,editor) {
      // Hide the move down button for the last row
      if(editor.movedown_button) {
        if(i === self.rows.length - 1) {
          editor.movedown_button.style.display = 'none';
        }
        else {
          need_row_buttons = true;
          editor.movedown_button.style.display = '';
        }
      }

      // Hide the delete button if we have minItems items
      if(editor.delete_button) {
        if(minItems) {
          editor.delete_button.style.display = 'none';
        }
        else {
          need_row_buttons = true;
          editor.delete_button.style.display = '';
        }
      }
      
      if(editor.moveup_button) {
        need_row_buttons = true;
      }
    });
    
    // Show/hide controls column in table
    $each(this.rows,function(i,editor) {
      if(need_row_buttons) {
        editor.controls_cell.style.display = '';
      }
      else {
        editor.controls_cell.style.display = 'none';
      }
    });
    if(need_row_buttons) {
      this.controls_header_cell.style.display = '';
    }
    else {
      this.controls_header_cell.style.display = 'none';
    }
    
    var controls_needed = false;
  
    if(!this.value.length) {
      this.delete_last_row_button.style.display = 'none';
      this.remove_all_rows_button.style.display = 'none';
      this.table.style.display = 'none';
    }
    else if(this.value.length === 1  || this.hide_delete_buttons) {
      this.table.style.display = '';
      this.remove_all_rows_button.style.display = 'none';

      // If there are minItems items in the array, hide the delete button beneath the rows
      if(minItems || this.hide_delete_buttons) {
        this.delete_last_row_button.style.display = 'none';
      }
      else {
        this.delete_last_row_button.style.display = '';
        controls_needed = true;
      }
    }
    else {
      this.table.style.display = '';
      // If there are minItems items in the array, hide the delete button beneath the rows
      if(minItems || this.hide_delete_buttons) {
        this.delete_last_row_button.style.display = 'none';
        this.remove_all_rows_button.style.display = 'none';
      }
      else {
        this.delete_last_row_button.style.display = '';
        this.remove_all_rows_button.style.display = '';
        controls_needed = true;
      }
    }

    // If there are maxItems in the array, hide the add button beneath the rows
    if((this.schema.maxItems && this.schema.maxItems <= this.rows.length) || this.hide_add_button) {
      this.add_row_button.style.display = 'none';
    }
    else {
      this.add_row_button.style.display = '';
      controls_needed = true;
    }
    
    if(!controls_needed) {
      this.controls.style.display = 'none';
    }
    else {
      this.controls.style.display = '';
    }
  },
  refreshValue: function() {
    var self = this;
    this.value = [];

    $each(this.rows,function(i,editor) {
      // Get the value for this editor
      self.value[i] = editor.getValue();
    });
    this.serialized = JSON.stringify(this.value);
  },
  addRow: function(value) {
    var self = this;
    var i = this.rows.length;

    self.rows[i] = this.getElementEditor(i);

    var controls_holder = self.rows[i].table_controls;

    // Buttons to delete row, move row up, and move row down
    if(!this.hide_delete_buttons) {
      self.rows[i].delete_button = this.getButton('','delete',this.translate('button_delete_row_title_short'));
      self.rows[i].delete_button.className += ' delete';
      self.rows[i].delete_button.setAttribute('data-i',i);
      self.rows[i].delete_button.addEventListener('click',function(e) {
        e.preventDefault();
        e.stopPropagation();
        var i = this.getAttribute('data-i')*1;

        var value = self.getValue();

        var newval = [];
        $each(value,function(j,row) {
          if(j===i) return; // If this is the one we're deleting
          newval.push(row);
        });
        self.setValue(newval);
        self.onChange(true);
      });
      JSONEditor.domMethods.appendChild(controls_holder, self.rows[i].delete_button);
    }

    
    if(i && !this.hide_move_buttons) {
      self.rows[i].moveup_button = this.getButton('','moveup',this.translate('button_move_up_title'));
      self.rows[i].moveup_button.className += ' moveup';
      self.rows[i].moveup_button.setAttribute('data-i',i);
      self.rows[i].moveup_button.addEventListener('click',function(e) {
        e.preventDefault();
        e.stopPropagation();
        var i = this.getAttribute('data-i')*1;

        if(i<=0) return;
        var rows = self.getValue();
        var tmp = rows[i-1];
        rows[i-1] = rows[i];
        rows[i] = tmp;

        self.setValue(rows);
        self.onChange(true);
      });
      JSONEditor.domMethods.appendChild(controls_holder, self.rows[i].moveup_button);
    }
    
    if(!this.hide_move_buttons) {
      self.rows[i].movedown_button = this.getButton('','movedown',this.translate('button_move_down_title'));
      self.rows[i].movedown_button.className += ' movedown';
      self.rows[i].movedown_button.setAttribute('data-i',i);
      self.rows[i].movedown_button.addEventListener('click',function(e) {
        e.preventDefault();
        e.stopPropagation();
        var i = this.getAttribute('data-i')*1;
        var rows = self.getValue();
        if(i>=rows.length-1) return;
        var tmp = rows[i+1];
        rows[i+1] = rows[i];
        rows[i] = tmp;

        self.setValue(rows);
        self.onChange(true);
      });
      JSONEditor.domMethods.appendChild(controls_holder, self.rows[i].movedown_button);
    }

    if(value) self.rows[i].setValue(value);
  },
  addControls: function() {
    var self = this;

    this.collapsed = false;
    this.toggle_button = this.getButton('','collapse',this.translate('button_collapse'));
    if(this.title_controls) {
      JSONEditor.domMethods.appendChild(this.title_controls, this.toggle_button);
      this.toggle_button.addEventListener('click',function(e) {
        e.preventDefault();
        e.stopPropagation();

        if(self.collapsed) {
          self.collapsed = false;
          self.panel.style.display = '';
          self.setButtonText(this,'','collapse','Collapse');
        }
        else {
          self.collapsed = true;
          self.panel.style.display = 'none';
          self.setButtonText(this,'','expand','Expand');
        }
      });

      // If it should start collapsed
      if(this.options.collapsed) {
        $trigger(this.toggle_button,'click');
      }

      // Collapse button disabled
      if(this.schema.options && typeof this.schema.options.disable_collapse !== "undefined") {
        if(this.schema.options.disable_collapse) this.toggle_button.style.display = 'none';
      }
      else if(this.jsoneditor.options.disable_collapse) {
        this.toggle_button.style.display = 'none';
      }
    }

    // Add "new row" and "delete last" buttons below editor
    this.add_row_button = this.getButton(this.getItemTitle(),'add',this.translate('button_add_row_title',[this.getItemTitle()]));
    this.add_row_button.addEventListener('click',function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      self.addRow();
      self.refreshValue();
      self.refreshRowButtons();
      self.onChange(true);
    });
    JSONEditor.domMethods.appendChild(self.controls, this.add_row_button);

    this.delete_last_row_button = this.getButton(this.translate('button_delete_last',[this.getItemTitle()]),'delete',this.translate('button_delete_last_title',[this.getItemTitle()]));
    this.delete_last_row_button.addEventListener('click',function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      var rows = self.getValue();
      rows.pop();
      self.setValue(rows);
      self.onChange(true);
    });
    JSONEditor.domMethods.appendChild(self.controls, this.delete_last_row_button);

    this.remove_all_rows_button = this.getButton(this.translate('button_delete_all'),'delete',this.translate('button_delete_all_title'));
    this.remove_all_rows_button.addEventListener('click',function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      self.setValue([]);
      self.onChange(true);
    });
    JSONEditor.domMethods.appendChild(self.controls, this.remove_all_rows_button);
  }
});
