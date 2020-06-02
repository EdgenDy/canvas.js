(function(parent){
	var globals = {};
	var PrivateReference = (function(){
		function PrivateReference(){
			if(!(this instanceof PrivateReference))
				return new PrivateReference();
			this.constructor();
		}
		PrivateReference.prototype = {
			constructor : function(){
				this.references = [];
			},
			set : function(key,value){
				if(this.has(key))
					throw new Error("Key '" + key + "' already has value.");
				if(typeof key == "undefined" || key == null)
					throw new Error("Undefined key is invalid.");
					
				this.references.push({
					key : key,
					value : value
				});
				return value;
			},
			get : function(key){
				var ref = this.references;
				for(var ind in ref){
					if(ref[ind].key===key)
						return ref[ind].value;
				}
				return null;
			},
			has : function(key){
				var ref = this.references;
				for(var ind in ref){
					if(ref[ind].key === key)
						return true;
				}
				return false;
			}
		};
		
		return PrivateReference;
	})();
	
	var pr = new PrivateReference();
	var _ = function(key){
		return pr.get(key);
	}
	
	var Canvas = (function(parent){
		function Canvas(id){
			if(!(this instanceof Canvas))
				return new Canvas(id);
			this.constructor.call(this,id);
		}
		Canvas.prototype = {
			constructor : function(canvas){
				var $ = pr.set(this,{
					layers : [], remember : true, images : [], 
					animatorConf : {loop:false,loopInterval:0,fps:25},
					frameSequencer : null,
					animationQueue : []
				}), callback = function(){};
				
				if(arguments.length==0 || (canvas && canvas.nodeName != "CANVAS" && canvas.getContext))
					util.error("Invalid argument, it must be a valid canvas element.");
				$.context = canvas.getContext('2d');
				$.canvas = canvas;
			},
			render : function(){
				var $ = _(this);
				var context = $.context;
				render.call(this,arguments,context,function(obj){
					if($.remember)
						$.layers.push(obj)
				});
				return this;
			},
			draw : function(func){
				var $ = _(this);
				if(typeof func == "function")
					func.call(this,$.context);
				return this;
			},
			remember : function(b){
				if(typeof b === "boolean")
					_(this).remember = b;
				return this;
			},
			repaint : function(){
				var $ = _(this);
				var layers = $.layers;
				this.clearAll();
				this.render.apply(this,layers);
				return this;
			},
			clearAll : function(){
				var $ = _(this);
				$.context.clearRect(0,0,$.canvas.width,$.canvas.height);
				$.layers = [];
				return this;
			},
			addTo : function(elm){
				if(elm && elm.nodeName && elm.nodeType && typeof elm.appendChild == "function")
					elm.appendChild(_(this).canvas)
				else
					util.error("Invalid Element.");
				return this;
			},
			loadImages : function(imgArr,callback){
				Canvas.loadImages(imgArr,callback);
				return this;
			},
			getContext : function(type){
				return _(this).canvas.getContext(type);
			},
			animator : function(layers){
				var thisArg = this, $ = _(this);

				var fs = new FrameSet();
				var confg = $.animatorConf;
				fs.createFrames.apply(fs,arguments);
				this.remember(false);
				var fps = typeof confg.fps == "number" ? confg.fps : 25;
				var fsq = $.frameSequencer = new FrameSequencer(fs,fps,function(frame){
					thisArg.clearAll();
					for(var index in frame){
						thisArg.render(frame[index]);
					}
				});
				fsq.finished(function(frame){
					thisArg.remember(true);
					thisArg.clearAll();
					thisArg.render.apply(thisArg,frame);
				});
				if(confg.loop)
					fsq.loop(true);
				if(typeof confg.loopInterval=="number")
					fsq.loopInterval(confg.loopInterval);
				return fsq;
			},
			animatorConfig : function(obj){
				var $ = _(this);
				for(var prop in obj){
					if(prop in $.animatorConf)
						$.animatorConf[prop] = obj[prop];
					else
						util.error("Invalid configuration.");
				}
				return this;
			},
			animate : function(){
				return this.animator.apply(this,arguments).play();
			},
			set : function(obj){
				applyStyles.call(this,_(this).context,obj);
				return this;
			},
			getLayers : function(arg){
				var $ = _(this),arr = [];
				if(typeof arg == "function")
					for(var ind in $.layers){
						var item = arr[ind];
						arg.call(this,parseInt(ind),item);
					}
				else if(typeof arg == "number")
					return $.layers[arg];
				
				if(arguments.length==0){
					for(var ind in $.layers)
						arr.push($.layers[ind]);
					return arr;
				}
				return this;
			},
			addLayer : function(layer){
				var $ = _(this);
				if(!(layer instanceof Layer))
					util.error("Invalid layer, it must be an instance of a Layer class.");
				if($.layers.indexOf(layer)==-1){
					$.layers.push(layer);
					layer.context = this;
					this.render(layer);
				}
				return this;
			},
			removeLayer : function(name){
				var layers = _(this).layers, length = layers.length;
				if(typeof name == "number"){
					if(layers[name]){
						layers.splice(name,1);
						this.repaint();
					}
					return this;
				}
				for(var ind = 0; ind < length; ind++){
					var layer = layers[ind];
					if(layer.name === name){
						layers.splice(ind,1);
						length--;
						ind--;
					}
				}
				this.repaint();
				return this;
			}
		};
		
		function render(objArr,context,callback){
			if(typeof callback != "function")
				callback = function(){};
			for(var index in objArr){
				var obj = objArr[index];
				if(obj && obj.type in drawFunctions)
					drawFunctions[obj.type].call(this,context,obj);
				else if(typeof obj == "function")
					obj.call(this,context);
				else
					util.error("Invalid layer type.");
				callback.call(this,obj);
			}
		}
		function renderChildren(context,obj){
			if(!util.isArray(obj.children))
				return;
			var x = obj.x,y = obj.y;
			if(util.isUndefined(x,y))
				x = obj.points[0].x, y = obj.points[0].y;
			if(util.isUndefined(x,y))
				x = 0, y = 0;
			context.save();
			context.clip();
			context.translate(x,y);
			render.call(this,obj.children,context);
			context.restore();
		}
		var PI = Math.PI, deg = (PI/180),img, images = [],
		drawFunctions = {
			rect : function(ctx,obj){
				applyStyles.call(this,ctx,obj);
				ctx.beginPath();
				ctx.rect(obj.x,obj.y,obj.width,obj.height);
				ctx.closePath();
				fillStroke.call(ctx,obj);
				renderChildren.call(this,ctx,obj);
			},
			arc : function(ctx,obj){
				var p = obj.points;
				applyStyles.call(this,ctx,obj);
				ctx.beginPath();
				if(!p){
					if(!obj.counter)
						ctx.arc(obj.x,obj.y,obj.radius,obj.angle.start*deg,obj.angle.end*deg);
					else
						ctx.arc(obj.x,obj.y,obj.radius,obj.angle.start*deg,obj.angle.end*deg,true);
					if(obj.close!=false)
						ctx.closePath();
				}
				else{
					ctx.moveTo(p[0].x,p[1].y);
					ctx.arcTo(p[1].x,p[1].y,p[2].x,p[2].y,obj.radius);
					if(obj.close==true)
						ctx.closePath();
				}
				fillStroke.call(ctx,obj);
				renderChildren.call(this,ctx,obj);
			},
			circle : function(ctx,obj){
				applyStyles.call(this,ctx,obj);
				ctx.beginPath();
				ctx.arc(obj.x,obj.y,obj.radius,0,2*PI);
				ctx.closePath();
				fillStroke.call(ctx,obj);
				renderChildren.call(this,ctx,obj);
			},
			text : function(ctx,obj){
				applyStyles.call(this,ctx,obj);
				if(obj.stroke)
					if(obj.width)
						ctx.strokeText(obj.value,obj.x,obj.y,obj.width);
					else
						ctx.strokeText(obj.value,obj.x,obj.y);
				else
					if(obj.width)
						ctx.fillText(obj.value,obj.x,obj.y,obj.width);
					else
						ctx.fillText(obj.value,obj.x,obj.y);
				restoreContext.call(ctx,obj);
			},
			path : function(ctx,obj){
				applyStyles.call(this,ctx,obj);
				if(obj.begin!=false)
					ctx.beginPath();
				ctx.moveTo(obj.x,obj.y)
				
				for(var ind in obj.paths){
					var path = obj.paths[ind]
					
					if(path.type in pathPainter)
						pathPainter[path.type].call(ctx,path);
					else
						util.error("Unknown path type.");
				}
				
				if(obj.close)
					ctx.closePath();
				fillStroke.call(ctx,obj);
				renderChildren.call(this,ctx,obj);
			},
			line : function(ctx,obj){
				applyStyles.call(this,ctx,obj);
				var p = obj.points;
				ctx.beginPath();
				ctx.moveTo(p[0].x,p[0].y);
				if(p.length>2)
					for(var ind in p)
						ctx.lineTo(p[ind].x,p[ind].y);
				else
					ctx.lineTo(p[1].x,p[1].y);
				
				if(obj.close)
					ctx.closePath();
				fillStroke.call(ctx,obj);
			},
			quadCurve : function(ctx,obj){
				applyStyles.call(this,ctx,obj);
				var p = obj.points;
				ctx.beginPath();
				ctx.moveTo(p[0].x,p[0].y);
				ctx.quadraticCurveTo(p[1].x,p[1].y,p[2].x,p[2].y);
				
				if(obj.closePath!=false)
					ctx.closePath();
				fillStroke.call(ctx,obj);
			},
			bezierCurve : function(ctx,obj){
				applyStyles.call(this,ctx,obj);
				var p = obj.points;
				ctx.beginPath();
				ctx.moveTo(p[0].x,p[0].y);
				ctx.bezierCurveTo(p[1].x,p[1].y,p[2].x,p[2].y,p[3].x,p[3].y);
				if(obj.closePath!=false)
					ctx.closePath();
				fillStroke.call(ctx,obj);
			},
			custom : function(ctx,obj){
				if(typeof obj.paint == "function")
					obj.paint.call(this,ctx,obj);
			},
			context : function(ctx,obj){
				applyStyles.call(this,ctx,obj);
				if(forRestoringContext(obj))
					ctx.restore()
			},
			image : function(obj){
				var img = typeof obj.img == "number" ? images[obj.img] : obj.img;
				if(typeof img == "undefined" && obj.src){
					img = new Image();
					img.src = obj.src;
				}
				drawImage.call(ctx,obj,img);
				renderChildren.call(this,ctx,obj);
			}
		},
		styleSetter = {
			saveContext : function(obj){
				if(forSavingContext(obj))
					this.save();
			},
			textStyles : function(obj){
				if(typeof obj.font == "undefined"){
					var font = ["","","","15px","sans-serif"],fontStr = "";
					if(obj.fontStyle) font[0] = obj.fontStyle;
					if(obj.fontVariant) font[1] = obj.fontVariant;
					if(obj.fontWeight) font[2] = obj.fontWeight
					if(obj.fontSize)
						font[3] = typeof obj.fontSize == "number" ? obj.fontSize + "px" : obj.fontSize;
					if(obj.fontFamily) font[4] = obj.fontFamily;
					for(var ind in font){fontStr += font[ind]+" ";}
					fontStr = fontStr.trim();
					if(fontStr.length>0) this.font = fontStr;
				}
				else if(obj.font){
					this.font = obj.font;
				}
				if(obj.align)
					this.textAlign = obj.align;
				if(obj.baseline)
					this.textBaseline = obj.baseline;
			},			
			globalStyles : function(obj){
				if(util.isNumber(obj.opacity))
					this.globalAlpha = obj.opacity;
				if(obj.composite)
					this.globalCompositeOperation = obj.composite;
			},			
			lineStyles : function(obj){
				if(obj.cap)
					this.lineCap = obj.cap;
				if(obj.join)
					this.lineJoin = obj.join;
				if(obj.lineWidth)
					this.lineWidth = obj.lineWidth;
				if(obj.miterLimit)
					this.miterLimit = obj.miterLimit;
			},			
			color : function(obj){
				if(obj.color){
					var color = new Color(obj.color).toString();
					this.fillStyle = color;
					this.strokeStyle = color;
				}
			},			
			fillStrokeStyle : function(obj){
				var type, value, style;
				if(obj.fillStyle)
					type = "fill",value = obj.fillStyle;
				else if(obj.strokeStyle)
					type = "stroke",value = obj.strokeStyle;
				else 
					return;
				
				if(util.isArray(value)){
					style = new Color(value).toString();
				}
				else if(value.type.indexOf("Gradient")>-1){
					var cs = value.colorStop;
					var gradient = createGradient.call(this,value);
					for(var ind in cs){
						var stop = cs[ind];
						gradient.addColorStop(stop.pos,new Color(stop.color).toString());
					}
					style = gradient;
				}
				else if(value.type == "pattern"){
					var img = typeof value.img == "number" ? images[value.img] : value.img;
					if(typeof img == "undefined" && value.src){
						img = new Image();
						img.src = value.src;
					}
					style = this.createPattern(img,value.repeat);
				}
				else{
					util.error("Invalid Fill or Stroke Style type.");
				}
				type == "fill" ? this.fillStyle = style : this.strokeStyle = style;
			},			
			shadow : function(obj){
				if(obj.shadow){
					var shd = obj.shadow;
					this.shadowOffsetX = shd.x;
					this.shadowOffsetY = shd.y,
					this.shadowBlur = shd.blur;
					this.shadowColor = new Color(shd.color).toString();
				}
			},			
			transformStyles : function(obj){
				if(obj.translate)
					this.translate(obj.translate.x,obj.translate.y);
				if(obj.scale)
					this.scale(obj.scale.width,obj.scale.height);	
					
				if(obj.transform || obj.Transform){
					var prop = obj.transform ? "transform" : "Transform";
					var transform = obj[prop];
					var scale = transform.scale;
					var skew = transform.skew;
					var trans = transform.translate;
					
					if(prop=="transform")
						this.transform(scale.width,skew.x,skew.y,scale.height,trans.x,trans.y);
					else
						this.setTransform(scale.width,skew.x,skew.y,scale.height,trans.x,trans.y);
				}

				if(validRotate(obj))
					var x = 0, y = 0, angle = obj.rotate;
					if(util.isObject(obj.rotate))
						x = obj.rotate.x,y = obj.rotate.y,angle = obj.rotate.angle,
						this.save(),this.translate(x,y),this.rotate(angle*Math.PI/180),
						this.translate(-x,-y);
			}
		},
		pathPainter = {
			line : function(path){
				var p = path.points;
				this.lineTo(p[0].x,p[0].y);
				if(p.length>1)
					for(var ind in p)
						this.lineTo(p[ind].x,p[ind].y);
			},
			arc : function(path){
				var p = path.points;
				this.arcTo(p[0].x,p[0].y,p[1].x,p[1].y,p[1].radius);
			},
			quadCurve : function(path){
				var p = path.points;
				this.quadraticCurveTo(p[0].x,p[0].y,p[1].x,p[1].y);
			},
			bezierCurve : function(path){
				var p = path.points;
				this.bezierCurveTo(p[0].x,p[0].y,p[1].x,p[1].y,p[2].x,p[2].y);
			}
		};
		
		function forSavingContext(obj){
			return (obj.save||obj.saveAndRestore);
		}
		
		function forRestoringContext(obj){
			return (obj.restore||obj.saveAndRestore||validRotate(obj));
		}
		
		function validRotate(obj){
			return (util.isNumber(obj.rotate)||util.isObject(obj.rotate));
		}
		
		function clipContext(obj){
			if(obj.clip)
				this.clip();
		}
		
		function restoreContext(obj){
			if(forRestoringContext(obj))
				this.restore();
		}
		
		function applyStyles(ctx,obj){
			for(var func in styleSetter)
				styleSetter[func].call(ctx,obj);
		}
		
		function fillStroke(obj){
			if(!!obj.stroke || (obj.type == "path" && obj.fill != true) || 
				(obj.type in pathPainter && obj.fill == undefined) || obj.type == "line" && obj.fill != true)
				this.stroke();
			else
				this.fill();
			
			clipContext.call(this,obj);
			restoreContext.call(this,obj);
		}
		
		function createGradient(obj){
			var from = obj.from;
			var to = obj.to;
			if(obj.type=="linearGradient")
				return this.createLinearGradient(from.x,from.y,to.x,to.y);
			else if(obj.type=="radialGradient")
				return this.createRadialGradient(from.x,from.y,from.radius,to.x,to.y,to.radius);
			else
				util.error("Invalid gradient type.");
		}
		
		function drawImage(obj,img){
			var clip = obj.clip;
			if(!util.isUndefined(clip) && !util.isUndefined(obj.x,obj.y,obj.width,obj.height,
				clip.x,clip.y,clip.width,clip.height))
				this.drawImage(img,obj.x,obj.y,obj.width,obj.height,
					clip.x,clip.y,clip.width,clip.height);
			else if(!util.isUndefined(obj.x,obj.y,obj.width,obj.height))
				this.drawImage(img,obj.x,obj.y,obj.width,obj.height);
			else if(!util.isUndefined(obj.x,obj.y))
				this.drawImage(img,obj.x,obj.y)
			else
				util.error("Invalid arguments.");
		}
		
		Canvas.loadImages = function(imgArr,success,error){
			var pr = new PrivateReference();
			success = typeof success == "function" ? success : function(){};
			error = typeof error == "function" ? error : function(){};
			if(!util.isArray(imgArr))
				util.error("Invalid argument, image array must be an array.");
			var length = imgArr.length;
			for(var index in imgArr){
				var img = new Image();
				pr.set(img,{index:index,progress:(((parseInt(index)+1)/length))});
				img.onload=function(){
					var $ = pr.get(this);
					success.call(this,$.progress,$.index);
				}
				img.onerror=function(){
					var $ = pr.get(this);
					error.call(this,$.progress,$.index);
				}
				img.src = imgArr[index];
			}
		}
		return Canvas;
	})();
	
	var util = (function(parent){
		var toString = ({}).toString;
		var util = {
			extender : function(f1,f2,obj){
				f1.prototype = Object.create(f2.prototype);
				for(var a in obj){
					f1.prototype[a] = obj[a];
				}
			},
			isNumber : function(){
				var args = arguments;
				if(args.length==0)
					return !1;
				for(var a in args){
					if(typeof args[a] !== "number")
						return !1;
				}
				return !0;
			},
			isUndefined : function(){
				var args = arguments;
				for(var a in args){
					if(typeof args[0] !== "undefined")
						return !1;
				}
				return !0;
			},
			error : function(msg){
				throw new Error(msg);
			},
			isArray : Array.isArray || function(a){
				return toString.call(a).indexOf("Array") > -1;
			},
			isObject : function(a){
				return toString.call(a).indexOf("Object") > -1;
			}
		};
		return util;
	})();
	
	var Color = (function(parent){
		var hexArr = "0123456789abcdef".split(""), hexFmt = /^#[0-9a-f]{6}/,
		rgbExp = /^(rgb)([a]?)\(([0-9]+),([0-9]+),([0-9]+),?([0-9]+\.?[0-9]*?)?\)$/,
		colorNames;
		
		function Color(r,g,b,a){
			if(!(this instanceof Color))
				return new Color(r,g,b,a);
			this.constructor.apply(this,arguments);
		}
		
		Color.prototype = {
			constructor : function(r,g,b,a){
				if(typeof r == "string")
					if(cleanName(r) in colorNames)
						this.rgba.apply(this,parseColor(colorNames[cleanName(r)]))
					else
						this.rgba.apply(this,parseColor(r));
				else if(util.isUndefined(r))
					this.rgba(0,0,0,1);
				else if(isColorArr(r))
					this.rgba(r[0],r[1],r[2],r[3]);
				else if(isColorObj(r) )
					this.rgba(r.r,r.g,r.b,r.a);
				else
					this.rgba(r,g,b,a);
			},
			rgba : function(r,g,b,a){
				if( validRGB(r,g,b,a) )
					this.r=r,this.g=g,this.b=b,this.a=a==undefined?1:a;
				else
					util.error("Invalid rgb(a) color values.");
				return this;
			},
			rgb : function(r,g,b){
				return this.rgba(r,g,b);
			},
			toHex : function(){
				var $ = this;
				return "#"+rgbToHex($.r)+rgbToHex($.g)+rgbToHex($.b);
			},
			toHSL : function(){
				var hsl = rgbToHSL(this.r,this.g,this.b);
				return "hsl("+hsl.h+","+hsl.s+"%,"+hsl.l+"%"+")";
			},
			toString : function(){
				var alpha = "a";
				if(this.a == 1)
					alpha = "";
				return "rgb" + alpha + "(" + this.r + "," + this.g + "," + this.b + (!alpha ? "" : "," + this.a) + ")";
			}
		}
		function cleanName(str){
			return str.replace(/-/g,"").toLowerCase();
		}
		
		function rgbToHex(num){
			if(num<0&&num>255)
				util.error("Invalid rgb(a) color values.");
			num = num/16;
			var fd = Math.floor(num);
			var sd = Math.floor((num - fd)*16);
			return hexArr[fd]+hexArr[sd];
		}
		function hexToRGB(str){
			var rgb = [];
			if(!hexFmt.exec(str)) 
				throw "Invalid Hexadecimal format.";
			var arr = str.split("");
			var a = 1, len = arr.length;
			for(a ; a < len; a+=2){
				rgb.push((hexArr.indexOf(arr[a])+(hexArr.indexOf(arr[a+1])/16))*16);
			}
			return rgb;
		}
		function rgbToHSL(r,g,b){
			var R=r/255,G=g/255,B=b/255,min = Math.min(R,G,B),
			max = Math.max(R,G,B),L = (max+min)/2,S,H;
			if(min === max) return {h:0,s:0,l:Math.round(L*100)};
			if(L<0.5) S=(max-min)/(max+min);
			else S=(max-min)/(2.0-max-min);
			if(max==r) H = (g-b)/(max-min);
			else if(max==g) H = 2.0 + (b-r)/(max-min);
			else H = 4.0 + (r-g)/(max-min);
			H = H*60;
			if(H<0) H += 360;
			return {h:Math.round(H),s:S*100,l:L*100};
		}
		function rgbToRGB(str){
			var color = [];
			var match = rgbExp.exec(str);
			color.push(parseFloat(match[3]));
			color.push(parseFloat(match[4]));
			color.push(parseFloat(match[5]));
			if(!match)
				util.error("Unable to parse '" + str + "'.");
			
			if(match[2] && match[6])
				color.push(parseFloat(match[6]));
			else
				color.push(1);
			return color;
		}
		
		function parseColor(str){
			if(str.indexOf("rgb")==0)
				return rgbToRGB(str);
			else if(str.indexOf("#")==0)
				return hexToRGB(str.toLowerCase());
			else
				util.error("Unknown color syntax");
		}
		Color.parseColor = parseColor;
		
		function validRGB(){
			var args = arguments;
			if(args.length==0)
				return !1;
			for(var a in args){
				var c = args[a];
				if(c > 255 || c < 0)
					return !1;
			}
			return !0;
		}
		function isColorObj(obj){
			if( obj.a == undefined )
				obj.a = 1;
			if( util.isNumber(obj.r,obj.g,obj.b,obj.a) && validRGB(obj.r,obj.g,obj.b,obj.a) )
				return !0;
			return !1;
		}
		function isColorArr(arr){
			if( arr[3] == undefined )
				arr[3] = 1;
			if( util.isNumber(arr[0],arr[1],arr[2],arr[3]) && validRGB(arr[0],arr[1],arr[2],arr[3]) )
				return !0;
			return !1;
		}
		function isColorObject(a){
			return (a!=null&& a!=undefined) && (isColorObj(a) || isColorArr(a));
		}
		
		var colorNames = {
			aliceblue:'#f0f8ff', antiquewhite:'#faebd7', aqua:'#00ffff', aquamarine:'#7fffd4', 
			azure:'#f0ffff', beige:'#f5f5dc', bisque:'#ffe4c4', black:'#000000', 
			blanchedalmond:'#ffebcd', blue:'#0000ff', blueviolet:'#8a2be2', brown:'#a52a2a', 
			burlywood:'#deb887', cadetblue:'#5f9ea0', chartreuse:'#7fff00', chocolate:'#d2691e', 
			coral:'#ff7f50', cornflowerblue:'#6495ed', cornsilk:'#fff8dc', crimson:'#dc143c', 
			cyan:'#00ffff', darkblue:'#00008b', darkcyan:'#008b8b', darkgoldenrod:'#b8860b', 
			darkgray:'#a9a9a9', darkgrey:'#a9a9a9', darkgreen:'#006400', darkkhaki:'#bdb76b', 
			darkmagenta:'#8b008b', darkolivegreen:'#556b2f', darkorange:'#ff8c00', darkorchid:'#9932cc', 
			darkred:'#8b0000', darksalmon:'#e9967a', darkseagreen:'#8fbc8f', darkslateblue:'#483d8b', 
			darkslategray:'#2f4f4f', darkslategrey:'#2f4f4f', darkturquoise:'#00ced1', darkviolet:'#9400d3', 
			deeppink:'#ff1493', deepskyblue:'#00bfff', dimgray:'#696969', dimgrey:'#696969', 
			dodgerblue:'#1e90ff', firebrick:'#b22222', floralwhite:'#fffaf0', forestgreen:'#228b22', 
			fuchsia:'#ff00ff', gainsboro:'#dcdcdc', ghostwhite:'#f8f8ff', gold:'#ffd700', 
			goldenrod:'#daa520', gray:'#808080', grey:'#808080', green:'#008000', 
			greenyellow:'#adff2f', honeydew:'#f0fff0', hotpink:'#ff69b4', indianred:'#cd5c5c', 
			indigo:'#4b0082', ivory:'#fffff0', khaki:'#f0e68c', lavender:'#e6e6fa', 
			lavenderblush:'#fff0f5', lawngreen:'#7cfc00', lemonchiffon:'#fffacd', lightblue:'#add8e6', 
			lightcoral:'#f08080', lightcyan:'#e0ffff', lightgoldenrodyellow:'#fafad2', lightgray:'#d3d3d3', 
			lightgrey:'#d3d3d3', lightgreen:'#90ee90', lightpink:'#ffb6c1', lightsalmon:'#ffa07a', 
			lightseagreen:'#20b2aa', lightskyblue:'#87cefa', lightslategray:'#778899', lightslategrey:'#778899', 
			lightsteelblue:'#b0c4de', lightyellow:'#ffffe0', lime:'#00ff00', limegreen:'#32cd32', 
			linen:'#faf0e6', magenta:'#ff00ff', maroon:'#800000', mediumaquamarine:'#66cdaa', 
			mediumblue:'#0000cd', mediumorchid:'#ba55d3', mediumpurple:'#9370db', mediumseagreen:'#3cb371', 
			mediumslateblue:'#7b68ee', mediumspringgreen:'#00fa9a', mediumturquoise:'#48d1cc', mediumvioletred:'#c71585', 
			midnightblue:'#191970', mintcream:'#f5fffa', mistyrose:'#ffe4e1', moccasin:'#ffe4b5', 
			navajowhite:'#ffdead', navy:'#000080', oldlace:'#fdf5e6', olive:'#808000', 
			olivedrab:'#6b8e23', orange:'#ffa500', orangered:'#ff4500', orchid:'#da70d6', 
			palegoldenrod:'#eee8aa', palegreen:'#98fb98', paleturquoise:'#afeeee', palevioletred:'#db7093', 
			papayawhip:'#ffefd5', peachpuff:'#ffdab9', peru:'#cd853f', pink:'#ffc0cb', 
			plum:'#dda0dd', powderblue:'#b0e0e6', purple:'#800080', rebeccapurple:'#663399', 
			red:'#ff0000', rosybrown:'#bc8f8f', royalblue:'#4169e1', saddlebrown:'#8b4513', 
			salmon:'#fa8072', sandybrown:'#f4a460', seagreen:'#2e8b57', seashell:'#fff5ee', 
			sienna:'#a0522d', silver:'#c0c0c0', skyblue:'#87ceeb', slateblue:'#6a5acd', 
			slategray:'#708090', slategrey:'#708090', snow:'#fffafa', springgreen:'#00ff7f', 
			steelblue:'#4682b4', tan:'#d2b48c', teal:'#008080', thistle:'#d8bfd8', 
			tomato:'#ff6347', turquoise:'#40e0d0', violet:'#ee82ee', wheat:'#f5deb3', 
			white:'#ffffff', whitesmoke:'#f5f5f5', yellow:'#ffff00', yellowgreen:'#9acd32'
		}
		Color.colorNames = colorNames;
		return Color;
	})();
	
	var Timer = (function(parent){
		function Timer(delay,cb){
			if(!(this instanceof Timer))
				return new Timer(delay,cb);
			this.constructor.apply(this,arguments);
		}
		Timer.prototype = {
			constructor : function(delay,cb,sc){
				pr.set(this,{
					delay : typeof delay == "number" && delay > -1 ? delay : util.error("Invalid delay."),
					callback : typeof cb == "function" ? cb : util.error("Invalid callback."),
					stateChange : typeof sc == "function" ? sc : function(){},
					state : "ready",
					activeTimer : null
				});
				this.state = "ready";
			},
			start : function(){
				var $ = _(this);
				if(this.stopped())
					this.reset();
				if(this.ready()||this.paused()){
					$.activeTimer = setInterval($.callback,$.delay);
					$.stateChange.call(this,"running");
					$.state = this.state = "running";
				}
				return this;
			},
			stop : function(){
				var $ = _(this);
				if(this.paused() || this.running()){
					clearInterval($.activeTimer);
					$.state = this.state = "stopped";
					$.stateChange.call(this,"stopped");
				}
				return this;
			},
			pause : function(){
				var $ = _(this);
				if(this.running()){
					clearInterval($.activeTimer);
					$.state = this.state = "paused";
					$.stateChange.call(this,"paused");
				}
				return this;
			},
			reset : function(){
				var $ = _(this);
				if(this.stopped()){
					$.state = this.state = "ready";
					$.activeTimer = null;
					$.stateChange.call(this,"ready");
				}
				return this;
			},
			status : function(){
				return _(this).status;
			},
			ready : function(){
				return _(this).state == "ready";
			},
			running : function(){
				return _(this).state == "running";
			},
			paused : function(){
				return _(this).state == "paused"
			},
			stopped : function(){
				return _(this).state == "stopped";
			},
			changeCallback : function(cb){
				if(typeof cb == "function"){
					_(this).callback = cb;
					if(this.running()){
						this.stop();
						this.reset();
						this.start();
					}
				}
				return this;
			},
			changeDelay : function(delay){
				if(typeof delay=="number" && delay > 0){
					_(this).delay = delay;
					if(this.running()){
						this.stop();
						this.reset();
						this.start();
					}
				}
				return this;
			}
		};
		return Timer;
	})();
	
	var FrameSequencer = (function(parent){
		function FrameSequencer(frameSet,fps,callback){
			if(!(this instanceof FrameSequencer))
				return new FrameSequencer(frameSet,fps,callback);
			this.constructor.apply(this,arguments);
		}
		FrameSequencer.prototype = {
			constructor : function(fs,fps,cb){
				__init__.call(this,fs,fps,cb);
			},
			play : function(){
				_(this).timer.start();
				return this;
			},
			stop : function(){
				_(this).timer.stop();
				return this;
			},
			pause : function(){
				_(this).timer.pause();
				return this;
			},
			reset : function(){
				_(this).timer.reset();
				return this;
			},
			adjustFrameIndex : function(val){
				var $ = _(this);
				if($.frameIndex+val < 0 || $.frameIndex+val > ($.frameSet.length-1))
					util.error("Invalid adjustment.");
				if(typeof val == "number")
					$.frameIndex+=val;
				else
					util.error("Invalid adjustment value.");
				$.progress = ($.frameIndex+1) / $.frameSet.length;
				$.callback.call(this,$.frameSet[$.frameIndex],$.progress,$.frameIndex);
				return this;
			},
			next : function(){
				return this.adjustFrameIndex(1);
			},
			prev : function(){
				return this.adjustFrameIndex(-1);
			},
			loop : function(bool){
				if(arguments.length==0)
					return _(this).loop;
				_(this).loop = !!bool;
				return this;
			},
			loopInterval : function(value){
				if(arguments.length==0)
					return _(this).loopInterval;
				if(typeof value != "number" || value < 0)
					util.error("Invalid 'loopInterval' value.");
				_(this).loopInterval = value;
				return this;
			},
			finished : function(callback){
				var $ = _(this);
				if(typeof callback == "function")
					$.finished = callback;
				return this;
			}
		};
		
		function __init__(fs,fps,cb){
			var $ = pr.set(this,{
				frameSet : fs instanceof FrameSet ? fs : util.error("Non-FrameSet argument is invalid."),
				fps : fps > 0 && fps < 1001 ? fps : util.error("Invalid scope of frame per second."),
				callback : typeof cb == "function" ? cb : util.error("Invalid callback."),
				timer : null, frameIndex : -1, progress : 0, loop : false,
				loopInterval : 0,
				finished : function(){}
			}), thisArg = this,length = $.frameSet.length;
			
			$.timer = new Timer(1000/fps,function(){
				$.frameIndex++;
				$.progress = ($.frameIndex+1)/length;
				$.callback.call(thisArg,$.frameSet[$.frameIndex],$.progress,$.frameIndex);
				
				if($.frameIndex==length-1){
					$.frameIndex = -1, $.progress = 0, $.timer.stop();
					if($.loop)
						if($.loopInterval>0)
							setTimeout(function(){ $.timer.start(); },$.loopInterval);
						else
							$.timer.start();
					
					else
						setTimeout(function(){
							$.finished.call(thisArg,$.frameSet[length-1]);
						},0);
				}
			});
		}
		
		return FrameSequencer;
	})();
	
	var FrameSet = (function(parent){
		var arr = [], timingFunctions,valueCalculator;
		function FrameSet(length){
			if(!(this instanceof FrameSet))
				return new FrameSet(length);
			this.constructor.apply(this,arguments);
		}
		
		FrameSet.prototype = {
			constructor : function(length){
				if(typeof length == "number" && length > 0)
					for(var a = 0; a < length; a++ ) this.push([]);
				else
					this.length = 0;
			},
			length : function(){
				return this.length;
			},
			add : function(obj,index){
				if(typeof index == "undefined")
					if(!this[this.length])
						this.push([obj]);
					else
						this[this.length].push(obj);
				else
					this.insert(obj,index);
				return obj;
			},
			insert : function(obj,index){
				if(typeof index != "number")
					util.error("Invalid index.");
				
				if(!this[index]){
					if(this.length <= index)
						this.length = index;
					this.splice(index,0,[obj]);
				}
				else{
					this[index].push(obj);
				}
				return obj;
			},
			remove : function(index,arrIndex){
				var $ = _(this);
				if(util.isNumber(index,arrIndex))
					return $.set[index].splice(arrIndex,0);
				else if(util.isNumber(index))
					return $.set.splice(arrIndex,0);
				else if(arguments.length==0)
					return $.set.pop();
				else
					util.error("Invalid arguments. Non-number indexes is invalid.");
			},
			replace : function(){
				
			},
			find : function(objProp,objValue,index){
				var result = [];
				if(typeof index == "number")
					find.call(this,objProp,objValue,index,result);
				else
					for(var prop in this){
						if(typeof parseInt(prop) !== "number")
							continue;
						find.call(this,objProp,objValue,parseInt(prop),result);
					}
				return result;
			},
			exists : function(objProp,objValue,index){
				return this.find(objProp,objValue,index) > 0;
			},
			createFrames : function(){
				createFrames.apply(this,arguments);
				return this;
			},
			length : 0,
			push : arr.push,
			splice : arr.splice
		};
		
		function find(objProp,objValue,index,result){
			var arr = this[index];
			for(var prop in arr){
				var item = arr[prop];
				if(item[objProp] === objValue)
					result.push(item);
			}
		}
		
		function createFrames(){
			var fs = this instanceof FrameSet ? this : new FrameSet(), args = arguments, id = 0;
			for(var prop in args){
				var obj = args[prop], animation = obj.animation;
				obj.id = id++;
				if(util.isUndefined(animation) && util.isNumber(obj.start,obj.end))
					putOnFrameSet(fs,obj,obj.start,obj.end,obj.from,obj.to);
				else if(util.isArray(animation))
					for(var ind in animation){
						var item = animation[ind];
						checkStartEndFromToProperty(item);
						putOnFrameSet(fs,obj,item.start,item.end,item.from,item.to,item.timing,item);
					}
				else
					util.error("Undefined 'animation' or 'start' and 'end' property.");
			}
			return fs;
		}
		
		function putOnFrameSet(fs,obj,start,end,from,to,timing,item){
			var max = end-start;
			for(var num = 0; num <= max; num++){
				var progress = (num/max), existObj, easing = progress;
				if(timing in timingFunctions)
					easing = timingFunctions[timing].call(null,progress);
				for(var toProp in to){
					var newPropValue;					
					if(toProp in valueCalculator)
						newPropValue = valueCalculator[toProp].call(null,from[toProp],to[toProp],easing,obj);
					else
						newPropValue = defaultValueCalculator(from[toProp],to[toProp],easing,obj);
					
					existObj = fs.find("id",obj.id,start+num);
					
					if(existObj.length > 0) 
						modifyLayer(existObj[0],item,toProp,newPropValue);
						
					modifyLayer(obj,item,toProp,newPropValue);
				}
				if(!existObj || existObj.length == 0)
					fs.add(clonePlainObject(obj,cleanObject),start+num);
			}
		}
		
		function modifyLayer(obj,item,toProp,newPropValue){
			if(util.isNumber(item.pathIndex,item.pointIndex))
				obj.paths[item.pathIndex].points[item.pointIndex][toProp] = newPropValue;
			else if(typeof item.pointIndex == "number")
				obj.points[item.pointIndex][toProp] = newPropValue;
			else if(typeof item.childrenIndex == "number")
				obj.children[item.childrenIndex][toProp] = newPropValue;
			else
				obj[toProp] = newPropValue;
		}
		
		function cleanObject(prop){
			if(prop=="animation"||prop=="start"||prop=="end") return !1;
			return !0;
		}
		
		function defaultValueCalculator(from, to, progress){
			return from + (to-from) * progress;
		}
		
		function checkStartEndFromToProperty(obj){
			var str = "Undefined '";
			var to = "' property of animation object.";
			if(!obj.from)
				util.error(str+"from"+to);
			if(!obj.to)
				util.error(str+"to"+to);
			if(util.isUndefined(obj.start))
				util.error(str+"start"+to);
			if(util.isUndefined(obj.end))
				util.error(str+"end"+to);
			if(obj.start<0)
				util.error("Negative values for 'start' property is invalid.");
			if(obj.start > obj.end)
				util.error("Invalid 'start' and 'end' values. 'start' property must be less than 'end' propery.");
		}
		globals.defaultValueCalculator = defaultValueCalculator;
		globals.modifyLayer = modifyLayer;
		globals.valueCalculator = valueCalculator = {
			color : function(frm,to,point){
				var c1 = new Color(frm),c2 = new Color(to);
				return [
					parseInt(c1.r+(c2.r-c1.r)*point),parseInt(c1.g+(c2.g-c1.g)*point),
					parseInt(c1.b+(c2.b-c1.b)*point),parseFloat(c1.a+(c2.a-c1.a)*point)
				];
			},
			fontSize : function(frm,to,point){
				var f1 = parseFloat(frm);
				return (f1 + (parseFloat(to)-f1) * point) + "px";
			},
			scale : function(frm,to,point){
				var x1 = frm.width,y1 = frm.height,x2 = to.width,y2 = to.width;
				return {width : x1+(x2-x1)*point,height : y1+(y2-y1)*point};
			},
			translate : function(from,to,progress){
				return {
					x : from.x + (to.x-from.x) * progress,
					y : from.y + (to.y-from.y) * progress
				};
			},
			transform : function(frm,to,point){
				var sc1 = frm.scale,sk1 = frm.skew,tr1 = frm.translate;
				var sc2 = to.scale,sk2 = to.skew,tr2 = to.translate;
				
				return {
					scale : {
						x : sc1.x+(sc2.x-sc1.x)*point,
						y : sc1.y+(sc2.y-sc1.y)*point
					},
					skew : {
						x : sk1.x+(sk2.x-sk1.x)*point,
						y : sk1.y+(sk2.y-sk1.y)*point
					},
					translate : {
						x : tr1.x+(tr2.x-tr1.x)*point,
						y : tr1.y+(tr2.y-tr1.y)*point
					}
				};
			},
			shadow : function(from,to,progress){
				return {
					x : from.x + (to.x-from.x) * progress,
					y : from.y + (to.y-from.y) * progress,
					blur : from.blur + (to.blur-from.blur) * progress,
					color : valueCalculator.color.call(null,from.color,to.color,progress)
				};
			},
			angle : function(from,to,progress,obj){
				return {
					start : util.isUndefined(from.start)?obj.angle.start:(from.start+(to.start-from.start)*progress),
					end : util.isUndefined(from.end)?obj.angle.end:(from.end+(to.end-from.end)*progress)
				};
			},
			rotate : function(from,to,progress,obj){
				return {
					angle : from.angle+(to.angle-from.angle)*progress,
					x : from.x+(to.x-from.x)*progress,
					y : from.y+(to.y-from.y)*progress
				};
			}
		};
		
		globals.timingFunctions = timingFunctions = {
			linear : function(p){
				return p;
			},
			easeInOut : function(p){
				return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
			},
			easeInSine : function(p){
				return 1 - Math.cos((p*Math.PI)/2);
			},
			easeInOutBack : function(x){
				var c1 = 1.70158;
				var c2 = c1 * 1.525;
				return x < 0.5 
					? (Math.pow(2*x,2) * ((c2+1) * 2 * x - c2)) / 2
					: (Math.pow(2*x-2,2) * ((c2+2) * (x*2-2) + c2) + 2) /2;
			},
			easeOutQuad : function(x){
				return 1 - (1-x) * (1-x);
			},
			easeInCubic : function(x){
				return x * x * x;
			},
			easeInQuint : function(x){
				return x * x * x * x * x;
			},
			easeInOutCubic : function(x){
				return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2*x+2,3) / 2;
			}
		};
		
		function clonePlainObject(obj,cb){
			var object = {}, cb = typeof cb == "function" ? cb : function(){return true;};
			for(var prop in obj){
				var item = obj[prop];
				if(!cb.call(this,prop,obj[prop]))
					continue;
				var value = item;
				if(util.isArray(item))
					value = clonePlainArray(item);
				else if(util.isObject(item))
					value == clonePlainObject(item);
				object[prop] = value;
			}
			return object;
		}
		
		function clonePlainArray(arr){
			var array = [];
			for(var index in arr){
				var item = arr[index],value = item;
				if(util.isObject(item))
					value = clonePlainObject(item);
				else if(util.isArray(item))
					value = clonePlainArray(item);
				array.push(value);
			}
			return array;
		}
		FrameSet.defineTimingFunction = function(name,func){
			if(typeof name != "string" && typeof func != "function")
				util.error("Invalid arguments, must be a string with a callback function that returns a number");
			timingFunctions[name] = func;
			return !0;
		}
		return FrameSet;
	})();
	
	var Layer = (function(){
		function Layer(layerObj){
			if(!(this instanceof Layer))
				return new Layer(layerObj);
			this.constructor(layerObj);
		}
		Layer.prototype = {
			constructor : function(layerObj){
				mergeProp(this,layerObj);
			},
			set : function(obj){
				if(util.isArray(this.transition)){
					var $ = _(this.context),transArr = this.transition;
					var repainter = $.repainter;
					if(!repainter)
						repainter = $.repainter = new Repainter(this.context);
					for(var prop in obj){
						for(var ind in transArr){
							var trans = transArr[ind];
							if(trans.prop === prop){
								var layerSet = {
									layer : this,
									prop : trans.prop,
									from : this[trans.prop],
									to : obj[prop],
									startTime : new Date().getTime(),
									duration : trans.duration,
									timing : trans.timing
								};
								var path = trans.pathIndex,point = trans.pointIndex,ch = trans.childrenIndex;
								if(util.isNumber(path,point))
									layerSet.pathIndex = path,
									layerSet.pointIndex = point,
									layerSet.from = this.path[path].points[point][trans.prop];
								else if(util.isNumber(trans.pointIndex))
									layerSet.pointIndex = trans.pointIndex,
									layerSet.from = this.points[point][trans.prop];
								else if(util.isNumber(trans.childrenIndex))
									layerSet.childrenIndex = trans.childrenIndex,
									layerSet.from = this.children[ch][trans.prop];
								repainter.queue(layerSet);	
							}
						}
					}
					mergeProp(this,obj);
					repainter.start();
				}
				else{
					mergeProp(this,obj);
					repaint.call(this);
				}
				return this;
			},
			bringToFront : function(){
				var layers = _(this.context).layers, length = layers.length;
				var index = layers.indexOf(this);
				
				if(util.isNumber(index))
					if(index < (length-1))
						layers.splice(index,1),
						layers.push(this);
				return this;
			},
			bringToBottom : function(){
				var layers = _(this.context).layers, length = layers.length;
				var index = layers.indexOf(this);
				
				if(util.isNumber(index))
					if(index > 0)
						layers.splice(index,1),
						layers.unshift(this);
				return this;
			}
		};
		function mergeProp(obj1,obj2){
			for(var prop in obj2){
				obj1[prop] = obj2[prop];
			}
		}
		function repaint(){
			if(this.context instanceof Canvas)
				this.context.repaint();
			return this;
		}
		return Layer;
	})();
	
	var Repainter = (function(){
		function Repainter(canvas){
			if(!(this instanceof Repainter))
				return new Repainter(canvas);
			this.constructor.call(this,canvas);
		}
		util.extender(Repainter,Timer,{
			constructor : function(canvas){
				var $ = this;
				if(!(canvas instanceof Canvas))
					util.error("Invalid argument, it must an instance of Canvas class.");
				this.layerQueue = [];
				Timer.prototype.constructor.call(this,16.67,function(){
					var layerQueue = $.layerQueue, length = layerQueue.length,
						now = new Date().getTime();
					if(length==0){
						$.stop();
						
						return;
					}
					for(var index = 0; index < length; index++){
						var item = layerQueue[index], start = item.startTime,
							prop = item.prop, duration = item.duration, timing = item.timing,
							from = item.from, to = item.to,layer = item.layer;
						var progress = (now-start)/duration,newValue,easing = progress;
						
						if(timing in globals.timingFunctions){
							if(progress > 1)
								progress = 1;
							easing = globals.timingFunctions[timing].call(null,progress);
						}
						
						if(prop in globals.valueCalculator)
							newValue = globals.valueCalculator[prop].call(null,from,to,easing);
						else
							newValue = globals.defaultValueCalculator(from,to,easing);
						
						globals.modifyLayer(layer,item,prop,newValue);
						
						if(progress>=1){
							layerQueue.splice(index,1);
							index--;
							length--;
						}							
					}
					canvas.repaint();
				});
			},
			queue : function(layer){
				this.layerQueue.push(layer);
				return this;
			},
			start : function(){
				return Timer.prototype.start.call(this);
			}
		});
		return Repainter;
	})();
	window.Repainter = Repainter;
	function rgb(r,g,b){
		return new Color(r,g,b).toString();
	}
	function rgba(r,g,b,a){
		return new Color(r,g,b,a).toString();
	}
	
	function canvas(arg){
		if(typeof arg == "function")
			return canvas.get().draw(arg);
		else if(typeof arg == "object" && typeof arg.getContext == "function")
			return canvas.set(arg);
		else if(typeof arg == "object")
			return canvas.create(arg);
		else
			return canvas.get(arg);
	}
	function hasCanvasInstance(canvas){
		var result,arr = pr.references;
		for(var ind in arr)
			if(arr[ind].value && arr[ind].value.canvas===canvas)
				return arr[ind].key;		
		return result;
	}
	var staticMethods = {
		get : function(arg){
			var canvas = null, existCanvas;
			if(util.isUndefined(arg))
				arg = 0;
			if(typeof arg == "number")
				canvas =  document.getElementsByTagName('canvas')[arg];
			else if(typeof arg == "string")
				canvas = document.getElementById(arg);
			else
				util.error("invalid argument, it must be an string id or a number index.");
			
			if(canvas&&canvas.nodeName=="CANVAS")
				if((existCanvas = hasCanvasInstance(canvas)))
					return existCanvas;
				else
					return new Canvas(canvas);
			else
				util.error("Your canvas can't be found.");
		},
		set : function(canvas){
			var existCanvas = null;
			if((existCanvas = hasCanvasInstance(canvas)))
				return existCanvas;
			return new Canvas(canvas);
		},
		create : function(obj){
			var canvas = document.createElement("canvas");
			if(util.isNumber(obj.width))
				canvas.width = obj.width;
			if(util.isNumber(obj.height))
				canvas.height = obj.height;
			if(typeof obj.id == "string")
				canvas.id = obj.id;
			return new Canvas(canvas);
		},
		frameSet : FrameSet,
		frameSequencer : FrameSequencer,
		color : Color,
		timer : Timer,
		rgbaToGlobal : function(){
			parent.rgb = rgb;
			return !!(parent.rgba = rgba);
		},
		layer : Layer,
		repainter : Repainter
	};
	for(var prop in staticMethods)
		canvas[prop] = staticMethods[prop];
	parent.canvas = canvas;
})(window);
