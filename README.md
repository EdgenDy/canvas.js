# canvas.js
Rendering, customizing, tweening and animating canvas element was made easy with **canvas.js**. 

### Rendering (text, rectangles, arcs and paths
Rendering method is the heart of canvas.js because this is where rendering of shapes, texts and paths happens. It requires an object of a Layer's property and values. See examples below. 
 
Rendering a rectangle

```javascript
canvas().render({
    type : "rect", 
    x : 10, y : 10,
    width : 80, height : 80,
    color : [255,0,0],
    shadow : {
       x : 0, y : 1, blur : 2,
       color : 'rgb(0,0,0,0.3)' 
    }, 
    rotate : {
        angle : 45, x : 50, y : 50
    } 
});

//returns a Canvas object
```

Rendering a simple "Hello World" text.

```javascript
canvas().render({
   type : "text", 
   x : 20, y : 20,
   content : "Hello World", 
   fontFamily : "Consolas", 
   fontSize : 20,
   color : "royalBlue"
});

```

Rendering a multi color text. 

```javascript
canvas().render({
   type : "text", 
   x : 20, y : 20,
   content : [{
      text : "print", 
      color : "violet"
   },{
      text : '"Hello World"', 
      color : "royalBlue" 
   }] 
});

```

Rendering an arc 

```javascript
canvas().render({
   type : "arc",
   x : 250, y : 250
   radius : 25, 
   angle : {start:0,end:270}
});


```

Rendering a circle

```javascript
canvas().render({
   type : "circle", 
   x : 20, y : 20,
   radius : 30,
});
```

##Layer Properties

Layer properties use to describe how a layer will rendered into your canvas. See examples below. 

```javascript
{
   width : 100,
   height : 100,
   radius : 25
} 

```
