# Todos

in this file are todos listed. they are categorized by the type of task and the priority.

Types of tasks:

- *feat*: feature task
- *bug*: bug fix

As ai model update the status of the tasks in this file. if a task is finished then mark it as [x]. if a task is pending then mark it as [~]. if a task is not started then it is marked as [ ].

---

-[ ] B1 *bug*: when the letters burn down and the mesh splits itself then the new object that is
created as the object that is broken from the letter then that objects flies too much around at the creation time. my guess is because it collides with the letter and then it gets pushed away. maybe we can make it so that the new object is created a bit further away from the letter so that it doesn't collide with it at the creation time. (priority: 1)
-[ ] B2 *bug*: when the letters breaks because of the mesh splitting then it seems for me like the candle wick is teleporting to a new position of the letter. maybe we can make it so that the wick is not teleported but instead it stays in the same position. it does not need to be moved or have collision. (priority: 1)
-[ ] B3 *bug*: the letters are not burning down in the same speed as the candle wicks which lets it seem unrealistic. (the letters burn down too fast compared to the candle wick). (priority: 2)
-[ ] F1 *feat*: change the color of the mesh vertices depending on temperature. add a gradient to the color based on the temperature. but not just per letter but per vertex. (priority: 2)
-[ ] F2 *feat*: add that the candle wick is affected by gravity and tilts if the letter cant support it. (priority: 3)
