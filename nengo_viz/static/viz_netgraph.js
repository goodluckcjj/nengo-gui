/**
 * Network diagram
 * @constructor
 *
 * @param {dict} args - A set of constructor arguments, including:
 * @param {int} args.id - the id of the server-side NetGraph to connect to
 * @param {DOMElement} args.parent - the element to add this component to
 */
VIZ.NetGraph = function(args) {
    var self = this;

    this.svg = this.createSVGElement('svg');
    this.svg.classList.add('netgraph');    
    this.svg.style.width = '100%';
    this.svg.style.height = 'calc(100% - 80px)';
    this.svg.style.position = 'fixed';
    args.parent.appendChild(this.svg);
    this.parent = args.parent;
        
    /** connect to server */
    this.ws = new WebSocket('ws://localhost:8080/viz_component?id=' + args.id);
    this.ws.binaryType = "arraybuffer";
    this.ws.onmessage = function(event) {self.on_message(event);}

    /** respond to resize events */
    this.svg.addEventListener("resize", function() {self.on_resize();});
    window.addEventListener("resize", function() {self.on_resize();});
    
    this.scale = 1.0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.svg_objects = {};
    
    var self = this;
    interact(this.svg)
        .draggable({
            onmove: function(event) {
                var w = self.get_scaled_width();
                var h = self.get_scaled_height(); 
                var dx = event.dx / w;
                var dy = event.dy / h;
                self.offsetX += dx;
                self.offsetY += dy;
                for (var key in self.svg_objects) {
                    self.svg_objects[key].redraw();
                }    
            }});
    
    interact(this.svg)
        .on('wheel', function(event) {
            var x = (event.clientX / self.svg.clientWidth);
            var y = (event.clientY / self.svg.clientHeight);
            var step_size = 1.1;
            var scale = event.wheelDeltaY > 0 ? step_size : 1.0 / step_size;
            
            var w = self.get_scaled_width(); 
            var h = self.get_scaled_height();
            var dw = w * scale - w;
            var dh = h * scale - h;
            
            // TODO: this math is not quite right
            self.offsetX = self.offsetX / scale - dw * x / (w * scale);
            self.offsetY = self.offsetY / scale - dh * y / (h * scale);
                    
            self.scale = scale * self.scale;
            for (var key in self.svg_objects) {
                self.svg_objects[key].redraw();
            }    
            
        });
    
    
};

/** Event handler for received WebSocket messages */
VIZ.NetGraph.prototype.on_message = function(event) {
    console.log(event.data);
    data = JSON.parse(event.data);
    if (data.type != 'conn') {
        this.create_object(data);
    }
};  

VIZ.NetGraph.prototype.createSVGElement = function(tag) {
    return document.createElementNS("http://www.w3.org/2000/svg", tag);
}


VIZ.NetGraph.prototype.create_object = function(info) {
    var item = new VIZ.NetGraphItem(this, info);
    this.svg_objects[info.uid] = item;    
};

VIZ.NetGraph.prototype.on_resize = function(event) {
    for (var key in this.svg_objects) {
        var item = this.svg_objects[key];
        item.set_position(item.pos[0], item.pos[1]);
        item.set_size(item.size[0], item.size[1]);
    }
};

VIZ.NetGraph.prototype.get_scaled_width = function() {
    return this.svg.clientWidth * this.scale;
}
VIZ.NetGraph.prototype.get_scaled_height = function() {
    return this.svg.clientHeight * this.scale;
}

VIZ.NetGraph.prototype.toggle_network = function(uid) {
    var item = this.svg_objects[uid];
    if (item.expanded) {
        item.g.classList.remove('expanded');
        item.label.setAttribute('transform', '');
        item.expanded = false;
        
    } else {
        item.g.classList.add('expanded');
        item.label.setAttribute('transform', 'translate(0, ' + ((item.size[1])*this.get_scaled_height()) + ')');
        item.expanded = true;
    
    }
}

VIZ.NetGraphItem = function(ng, info) {
    this.ng = ng;
    this.pos = info.pos;
    this.size = info.size;
    this.type = info.type;
    this.uid = info.uid;
    this.expanded = false;
    
    this.minWidth = 5;
    this.minHeight = 5;

    var g = this.ng.createSVGElement('g');
    this.g = g;
    ng.svg.appendChild(g);
    g.classList.add(this.type);
    
    this.set_position(info.pos[0], info.pos[1]);

    if (info.type == 'node') {
        this.shape = this.ng.createSVGElement('rect');
    } else if (info.type == 'net') {
        this.shape = this.ng.createSVGElement('rect');
        this.shape.setAttribute('rx', '15');
        this.shape.setAttribute('ry', '15');
    } else if (info.type == 'ens') {
        this.shape = this.ng.createSVGElement('ellipse');
        this.shape.setAttribute('cx', '0');
        this.shape.setAttribute('cy', '0');
    }
    this.set_size(info.size[0], info.size[1]);
    g.appendChild(this.shape);
    
    var label = this.ng.createSVGElement('text');
    this.label = label;
    label.innerHTML = info.label;
    g.appendChild(label);

    var uid = this.uid;
    var ng = ng;
    interact(g)
        .draggable({
            onmove: function(event) {
                var w = ng.get_scaled_width();
                var h = ng.get_scaled_height();    
                var item = ng.svg_objects[uid];
                item.set_position(item.pos[0] + event.dx/w, item.pos[1] + event.dy/h);
            }});
            
    interact(this.shape)
        .resizable({
            edges: { left: true, right: true, bottom: true, top: true }
            })
        .on('resizemove', function(event) {            
            var item = ng.svg_objects[uid];
            var w = ng.get_scaled_width();
            var h = ng.get_scaled_height();    
            
            item.set_size(item.size[0] + event.deltaRect.width / w / 2, 
                          item.size[1] + event.deltaRect.height / h / 2);
            item.set_position(item.pos[0] + event.deltaRect.width / w / 2 + 
                                            event.deltaRect.left / w, 
                              item.pos[1] + event.deltaRect.height / h / 2 + 
                                            event.deltaRect.top / h);
            });
            
    if (info.type == 'net') {
        interact(this.shape)
            .on('tap', function(event) {
                ng.toggle_network(uid);
            });
    }
};



VIZ.NetGraphItem.prototype.set_position = function(x, y) {
    this.pos = [x, y];
    var w = this.ng.svg.clientWidth * this.ng.scale;
    var h = this.ng.svg.clientHeight * this.ng.scale;    
    
    this.g.setAttribute('transform', 'translate(' + ((this.pos[0]+ this.ng.offsetX)*w) + ', ' + ((this.pos[1]+ this.ng.offsetY)*h) + ')');
};

VIZ.NetGraphItem.prototype.set_size = function(width, height) {
    this.size = [width, height];
    var w = this.ng.svg.clientWidth;
    var h = this.ng.svg.clientHeight;    
    
    var screen_w = width * w * this.ng.scale;
    var screen_h = height * h * this.ng.scale;
    if (screen_w < this.minWidth) {
        screen_w = this.minWidth;
    }
    if (screen_h < this.minHeight) {
        screen_h = this.minHeight;
    }
    
    if (this.type == 'ens') {
        this.shape.setAttribute('rx', screen_w);
        this.shape.setAttribute('ry', screen_h);    
    } else {
        this.shape.setAttribute('transform', 'translate(-' + screen_w + ', -' + screen_h + ')')
        this.shape.setAttribute('width', screen_w * 2);
        this.shape.setAttribute('height', screen_h * 2);
    }
    
    if (this.expanded) {
        this.label.setAttribute('transform', 'translate(0, ' + screen_h + ')');
    }
    
};

VIZ.NetGraphItem.prototype.redraw = function() {
    this.set_position(this.pos[0], this.pos[1]);
    this.set_size(this.size[0], this.size[1]);
}
