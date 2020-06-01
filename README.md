# canvas.js
Rendering, customizing, tweening and animating canvas element made easy with **canvas.js**. 

## Rendering
Rendering a rectangle, 10 pixels away from the upper left corner of the canvas with the size of 80 for its with and height with a shadow with an offset of 0 for its x-axis and an offset of 1 for its y-axis and a semi transparent for its shadow color, rotating 45 degrees on its center coordinates of 50 pixels for its x and y axis and finally filling with a color of red. 
```javascript
canvas().get(0).render({ // or just 'canvas().render({' for simplification
    type : "rect", 
    x : 10, y : 10,
    width : 80, height : 80,
    color : [255,0,0],
    shadow : {
       x : 0, y : 1, blur : 2,
       color : 'red' 
    }, 
    rotate : {
        angle : 45, x : 50, y : 50
    } 
});

//returns a Canvas object
```
