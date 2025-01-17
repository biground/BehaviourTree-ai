var behaviourTree;
(function (behaviourTree) {
    /**
     * 所有节点的根类
     */
    class Behavior {
        constructor() {
            this.status = behaviourTree.TaskStatus.Invalid;
        }
        /**
         * 使该节点的状态无效。
         * 组合体可以覆盖这一点并使其所有的子节点失效
         */
        invalidate() {
            this.status = behaviourTree.TaskStatus.Invalid;
        }
        /**
         * 在执行前立即调用。
         * 它被用来设置任何需要从上一次运行中重置的变量
         */
        onStart() { }
        /**
         * 当一个任务的状态改变为运行以外的其他状态时被调用
         */
        onEnd() { }
        /**
         * tick处理调用，以更新实际工作完成的地方。
         * 它的存在是为了在必要时可以调用onStart/onEnd。
         * @param context
         * @returns
         */
        tick(context) {
            if (this.status == behaviourTree.TaskStatus.Invalid)
                this.onStart();
            this.status = this.update(context);
            if (this.status != behaviourTree.TaskStatus.Running)
                this.onEnd();
            return this.status;
        }
    }
    behaviourTree.Behavior = Behavior;
})(behaviourTree || (behaviourTree = {}));
var behaviourTree;
(function (behaviourTree) {
    /**
     * 用来控制BehaviorTree的根类
     */
    class BehaviorTree {
        constructor(context, rootNode, updatePeriod = 0.2) {
            this._context = context;
            this._root = rootNode;
            this.updatePeriod = this._elapsedTime = updatePeriod;
        }
        tick() {
            // updatePeriod小于或等于0，将每一帧都执行
            if (this.updatePeriod > 0) {
                this._elapsedTime -= es.Time.deltaTime;
                if (this._elapsedTime <= 0) {
                    while (this._elapsedTime <= 0)
                        this._elapsedTime += this.updatePeriod;
                    this._root.tick(this._context);
                }
            }
            else {
                this._root.tick(this._context);
            }
        }
    }
    behaviourTree.BehaviorTree = BehaviorTree;
})(behaviourTree || (behaviourTree = {}));
var behaviourTree;
(function (behaviourTree) {
    /**
     * 帮助器，用于使用流畅的API构建BehaviorTree。
     * 叶子节点需要首先添加一个父节点。
     * 父节点可以是组合体或装饰体。
     * 当叶子节点被添加时，装饰器会自动关闭。
     * 组合体必须调用endComposite来关闭它们。
     */
    class BehaviorTreeBuilder {
        constructor(context) {
            /** 堆栈节点，我们是通过fluent API来建立的 */
            this._parentNodeStack = new Array();
            this._context = context;
        }
        static begin(context) {
            return new BehaviorTreeBuilder(context);
        }
        setChildOnParent(child) {
            let parent = behaviourTree.ArrayExt.peek(this._parentNodeStack);
            if (parent instanceof behaviourTree.Composite) {
                parent.addChild(child);
            }
            else if (parent instanceof behaviourTree.Decorator) {
                // 装饰者只有一个子节点，所以自动结束
                parent.child = child;
                this.endDecorator();
            }
            return this;
        }
        pushParentNode(composite) {
            if (this._parentNodeStack.length > 0)
                this.setChildOnParent(composite);
            behaviourTree.ArrayExt.push(this._parentNodeStack, composite);
            return this;
        }
        endDecorator() {
            this._currentNode = behaviourTree.ArrayExt.pop(this._parentNodeStack);
            return this;
        }
        action(func) {
            behaviourTree.Assert.isFalse(this._parentNodeStack.length == 0, '无法创建无嵌套的动作节点, 它必须是一个叶节点');
            return this.setChildOnParent(new behaviourTree.ExecuteAction(func));
        }
        actionR(func) {
            return this.action(t => func(t) ? behaviourTree.TaskStatus.Success : behaviourTree.TaskStatus.Failure);
        }
        conditional(func) {
            behaviourTree.Assert.isFalse(this._parentNodeStack.length == 0, '无法创建无嵌套的条件节点, 它必须是一个叶节点');
            return this.setChildOnParent(new behaviourTree.ExecuteActionConditional(func));
        }
        conditionalR(func) {
            return this.conditional(t => func(t) ? behaviourTree.TaskStatus.Success : behaviourTree.TaskStatus.Failure);
        }
        logAction(text) {
            behaviourTree.Assert.isFalse(this._parentNodeStack.length == 0, '无法创建无嵌套的动作节点, 它必须是一个叶节点');
            return this.setChildOnParent(new behaviourTree.LogAction(text));
        }
        waitAction(waitTime) {
            behaviourTree.Assert.isFalse(this._parentNodeStack.length == 0, '无法创建无嵌套的动作节点, 它必须是一个叶节点');
            return this.setChildOnParent(new behaviourTree.WaitAciton(waitTime));
        }
        subTree(subTree) {
            behaviourTree.Assert.isFalse(this._parentNodeStack.length == 0, '无法创建无嵌套的动作节点, 它必须是一个叶节点');
            return this.setChildOnParent(new behaviourTree.BehaviorTreeReference(subTree));
        }
        conditionalDecorator(func, shouldReevaluate = true) {
            let conditional = new behaviourTree.ExecuteActionConditional(func);
            return this.pushParentNode(new behaviourTree.ConditionalDecorator(conditional, shouldReevaluate));
        }
        conditionalDecoratorR(func, shouldReevaluate = true) {
            return this.conditionalDecorator(t => (func(t) ? behaviourTree.TaskStatus.Success : behaviourTree.TaskStatus.Failure), shouldReevaluate);
        }
        alwaysFail() {
            return this.pushParentNode(new behaviourTree.AlwaysFail());
        }
        alwaysSucceed() {
            return this.pushParentNode(new behaviourTree.AlwaysSucceed());
        }
        inverter() {
            return this.pushParentNode(new behaviourTree.Inverter());
        }
        repeater(count) {
            return this.pushParentNode(new behaviourTree.Repeater(count));
        }
        untilFail() {
            return this.pushParentNode(new behaviourTree.UntilFail());
        }
        untilSuccess() {
            return this.pushParentNode(new behaviourTree.UntilSuccess());
        }
        paraller() {
            return this.pushParentNode(new behaviourTree.Parallel());
        }
        parallelSelector() {
            return this.pushParentNode(new behaviourTree.ParallelSelector());
        }
        selector(abortType = behaviourTree.AbortTypes.None) {
            return this.pushParentNode(new behaviourTree.Selector(abortType));
        }
        randomSelector() {
            return this.pushParentNode(new behaviourTree.RandomSelector());
        }
        sequence(abortType = behaviourTree.AbortTypes.None) {
            return this.pushParentNode(new behaviourTree.Sequence(abortType));
        }
        randomSequence() {
            return this.pushParentNode(new behaviourTree.RandomSequence());
        }
        endComposite() {
            behaviourTree.Assert.isTrue(behaviourTree.ArrayExt.peek(this._parentNodeStack) instanceof behaviourTree.Composite, '尝试结束复合器，但顶部节点是装饰器');
            this._currentNode = behaviourTree.ArrayExt.pop(this._parentNodeStack);
            return this;
        }
        build(updatePeriod = 0.2) {
            // Assert.isNotNull(this._currentNode, "无法创建零节点的行为树");
            if (!this._currentNode)
                throw new Error('无法创建零节点的行为树');
            return new behaviourTree.BehaviorTree(this._context, this._currentNode, updatePeriod);
        }
    }
    behaviourTree.BehaviorTreeBuilder = BehaviorTreeBuilder;
})(behaviourTree || (behaviourTree = {}));
var behaviourTree;
(function (behaviourTree) {
    let TaskStatus;
    (function (TaskStatus) {
        TaskStatus[TaskStatus["Invalid"] = 0] = "Invalid";
        TaskStatus[TaskStatus["Success"] = 1] = "Success";
        TaskStatus[TaskStatus["Failure"] = 2] = "Failure";
        TaskStatus[TaskStatus["Running"] = 3] = "Running";
    })(TaskStatus = behaviourTree.TaskStatus || (behaviourTree.TaskStatus = {}));
})(behaviourTree || (behaviourTree = {}));
var behaviourTree;
(function (behaviourTree) {
    /**
     * 作为子项运行整个BehaviorTree并返回成功
     */
    class BehaviorTreeReference extends behaviourTree.Behavior {
        constructor(tree) {
            super();
            this._childTree = tree;
        }
        update(context) {
            this._childTree.tick();
            return behaviourTree.TaskStatus.Success;
        }
    }
    behaviourTree.BehaviorTreeReference = BehaviorTreeReference;
})(behaviourTree || (behaviourTree = {}));
var behaviourTree;
(function (behaviourTree) {
    /**
     * 包装一个Func，以便您可以避免必须子类来创建新操作
     */
    class ExecuteAction extends behaviourTree.Behavior {
        /**
         * Func<T, TaskStatus>
         */
        constructor(action) {
            super();
            this._action = action;
        }
        update(context) {
            behaviourTree.Assert.isNotNull(this._action, "action 必须不为空");
            return this._action(context);
        }
    }
    behaviourTree.ExecuteAction = ExecuteAction;
})(behaviourTree || (behaviourTree = {}));
var behaviourTree;
(function (behaviourTree) {
    /**
     * 简单的任务，它将输出指定的文本并返回成功。 它可以用于调试。
     */
    class LogAction extends behaviourTree.Behavior {
        constructor(text) {
            super();
            /** 是否输出error还是log */
            this.isError = false;
            this.text = text;
        }
        update(context) {
            if (this.isError)
                console.error(this.text);
            else
                console.log(this.text);
            return behaviourTree.TaskStatus.Success;
        }
    }
    behaviourTree.LogAction = LogAction;
})(behaviourTree || (behaviourTree = {}));
var behaviourTree;
(function (behaviourTree) {
    /**
     * 等待指定的时间。 任务将返回运行，直到任务完成等待。 在等待时间结束后它将返回成功。
     */
    class WaitAciton extends behaviourTree.Behavior {
        constructor(waitTime) {
            super();
            this._startTime = 0;
            this.waitTime = waitTime;
        }
        onStart() {
            this._startTime = 0;
        }
        update(context) {
            // 我们不能使用Time.deltaTime，因为行为树会按照自己的速率tick，所以我们只存储起始时间
            if (this._startTime == 0)
                this._startTime = es.Time.totalTime;
            if (es.Time.totalTime - this._startTime >= this.waitTime)
                return behaviourTree.TaskStatus.Success;
            return behaviourTree.TaskStatus.Running;
        }
    }
    behaviourTree.WaitAciton = WaitAciton;
})(behaviourTree || (behaviourTree = {}));
var behaviourTree;
(function (behaviourTree) {
    let AbortTypes;
    (function (AbortTypes) {
        /**
         * 没有中止类型。 即使其他条件更改了状态，当前操作也将始终运行
         */
        AbortTypes[AbortTypes["None"] = 0] = "None";
        /**
         * 如果一个更重要的有条件的任务改变了状态，它可以发出一个中止指令，使低优先级的任务停止运行，并将控制权转回高优先级的分支。
         * 这种类型应该被设置在作为讨论中的复合体的子体的复合体上。
         * 父复合体将检查它的子体，看它们是否有LowerPriority中止。
         */
        AbortTypes[AbortTypes["LowerPriority"] = 1] = "LowerPriority";
        /**
         * 只有当它们都是复合体的子任务时，条件任务才能中止一个行动任务。
         * 这个AbortType只影响它所设置的实际的Composite，不像LowerPriority会影响其父Composite。
         */
        AbortTypes[AbortTypes["Self"] = 2] = "Self";
        /**
         * 检查LowerPriority和Self aborts
         */
        AbortTypes[AbortTypes["Both"] = 3] = "Both";
    })(AbortTypes = behaviourTree.AbortTypes || (behaviourTree.AbortTypes = {}));
    class AbortTypesExt {
        static has(self, check) {
            return (self & check) == check;
        }
    }
    behaviourTree.AbortTypesExt = AbortTypesExt;
})(behaviourTree || (behaviourTree = {}));
var behaviourTree;
(function (behaviourTree) {
    /**
     * 任何复合节点必须子类化这个。为子节点和助手提供存储，以处理AbortTypes。
     */
    class Composite extends behaviourTree.Behavior {
        constructor() {
            super(...arguments);
            this.abortType = behaviourTree.AbortTypes.None;
            this._children = new Array();
            this._hasLowerPriorityConditionalAbort = false;
            this._currentChildIndex = 0;
        }
        invalidate() {
            super.invalidate();
            for (let i = 0; i < this._children.length; i++) {
                this._children[i].invalidate();
            }
        }
        onStart() {
            // 较低优先级的中止发生在下一级，所以我们在这里检查是否有
            this._hasLowerPriorityConditionalAbort = this.hasLowerPriorityConditionalAbortInChildren();
            this._currentChildIndex = 0;
        }
        onEnd() {
            // 我们已经做好了使我们的子节点无效的准备，使他们再下一帧做好准备 
            for (let i = 0; i < this._children.length; i++) {
                this._children[i].invalidate();
            }
        }
        /**
         * 检查复合体的子代，看是否有具有LowerPriority AbortType的复合体
         */
        hasLowerPriorityConditionalAbortInChildren() {
            for (let i = 0; i < this._children.length; i++) {
                // 检查是否有一个设置了中止类型的复合体
                let composite = this._children[i];
                if (composite != null && behaviourTree.AbortTypesExt.has(composite.abortType, behaviourTree.AbortTypes.LowerPriority)) {
                    // 现在确保第一个子节点是一个条件性的
                    if (composite.isFirstChildConditional())
                        return true;
                }
            }
            return false;
        }
        /**
         * 为这个复合体添加一个子节点
         */
        addChild(child) {
            this._children.push(child);
        }
        /**
         * 如果一个复合体的第一个子节点是一个条件体，返回true。用来处理条件性中止
         */
        isFirstChildConditional() {
            return behaviourTree.isIConditional(this._children[0]);
        }
        /**
         * 检查任何IConditional的子代，看它们是否已经改变了状态
         */
        updateSelfAbortConditional(context, statusCheck) {
            // 检查任何IConditional的子任务，看它们是否改变了状态
            for (let i = 0; i < this._currentChildIndex; i++) {
                let child = this._children[i];
                if (!behaviourTree.isIConditional(child))
                    continue;
                let status = this.updateConditionalNode(context, child);
                if (status != statusCheck) {
                    this._currentChildIndex = i;
                    // 我们有一个中止，所以我们使子节点无效，所以他们被重新评估
                    for (let j = i; j < this._children.length; j++)
                        this._children[j].invalidate();
                    break;
                }
            }
        }
        /**
         * 检查任何具有LowerPriority AbortType和Conditional作为第一个子代的组合体。
         * 如果它找到一个，它将执行条件，如果状态不等于 statusCheck，_currentChildIndex将被更新，即当前运行的Action将被中止。
         */
        updateLowerPriorityAbortConditional(context, statusCheck) {
            // 检查任何较低优先级的任务，看它们是否改变了状态
            for (let i = 0; i < this._currentChildIndex; i++) {
                let composite = this._children[i];
                if (composite != null && behaviourTree.AbortTypesExt.has(composite.abortType, behaviourTree.AbortTypes.LowerPriority)) {
                    // 现在我们只得到条件的状态（更新而不是执行），看看它是否发生了变化，并对条件装饰器加以注意
                    let child = composite._children[0];
                    let status = this.updateConditionalNode(context, child);
                    if (status != statusCheck) {
                        this._currentChildIndex = i;
                        // 我们有一个中止，所以我们使子节点无效，所以他们被重新评估
                        for (let j = i; j < this._children.length; j++)
                            this._children[j].invalidate();
                        break;
                    }
                }
            }
        }
        /**
         * 帮助器，用于获取一个条件或一个条件装饰器的任务状态
         * @param context
         * @param node
         * @returns
         */
        updateConditionalNode(context, node) {
            if (node instanceof behaviourTree.ConditionalDecorator)
                return node.executeConditional(context, true);
            else
                return node.update(context);
        }
    }
    behaviourTree.Composite = Composite;
})(behaviourTree || (behaviourTree = {}));
var behaviourTree;
(function (behaviourTree) {
    /**
     * 并行任务将运行每个子任务，直到一个子任务返回失败。
     * 不同的是，并行任务将同时运行其所有的子任务，而不是一次运行每个任务。
     * 像序列类一样，一旦它的所有子任务都返回成功，并行任务将返回成功。
     * 如果一个任务返回失败，并行任务将结束所有的子任务并返回失败。
     */
    class Parallel extends behaviourTree.Composite {
        update(context) {
            let didAllSucceed = true;
            for (let i = 0; i < this._children.length; i++) {
                let child = this._children[i];
                child.tick(context);
                // 如果任何一个子节点失败了，整个分支都会失败
                if (child.status == behaviourTree.TaskStatus.Failure)
                    return behaviourTree.TaskStatus.Failure;
                // 如果所有的子节点没有成功，我们还没有完成
                else if (child.status != behaviourTree.TaskStatus.Success)
                    didAllSucceed = false;
            }
            if (didAllSucceed)
                return behaviourTree.TaskStatus.Success;
            return behaviourTree.TaskStatus.Running;
        }
    }
    behaviourTree.Parallel = Parallel;
})(behaviourTree || (behaviourTree = {}));
var behaviourTree;
(function (behaviourTree) {
    /**
     * 与选择器任务类似，ParallelSelector任务一旦有子任务返回成功，就会返回成功。
     * 不同的是，并行任务将同时运行其所有的子任务，而不是一次运行每个任务。
     * 如果一个任务返回成功，并行选择器任务将结束所有的子任务并返回成功。
     * 如果每个子任务都返回失败，那么ParallelSelector任务将返回失败。
     */
    class ParallelSelector extends behaviourTree.Composite {
        update(context) {
            let didAllFail = true;
            for (let i = 0; i < this._children.length; i++) {
                let child = this._children[i];
                child.tick(context);
                // 如果有子节点成功了，我们就返回成功
                if (child.status == behaviourTree.TaskStatus.Success)
                    return behaviourTree.TaskStatus.Success;
                // 如果所有的子节点没有失败，我们还没有完成
                if (child.status != behaviourTree.TaskStatus.Failure)
                    didAllFail = false;
            }
            if (didAllFail)
                return behaviourTree.TaskStatus.Failure;
            return behaviourTree.TaskStatus.Running;
        }
    }
    behaviourTree.ParallelSelector = ParallelSelector;
})(behaviourTree || (behaviourTree = {}));
var behaviourTree;
(function (behaviourTree) {
    /**
     * 选择器任务类似于一个 "或 "操作。只要它的一个子任务返回成功，它就会返回成功。
     * 如果一个子任务返回失败，那么它将依次运行下一个任务。
     * 如果没有子任务返回成功，那么它将返回失败
     */
    class Selector extends behaviourTree.Composite {
        constructor(abortType = behaviourTree.AbortTypes.None) {
            super();
            this.abortType = abortType;
        }
        update(context) {
            // 首先，如果我们不在第一个子节点身上，我们就处理条件性中止
            if (this._currentChildIndex != 0)
                this.handleConditionalAborts(context);
            let current = this._children[this._currentChildIndex];
            let status = current.tick(context);
            // 如果子节点成功了或者还在跑，就提前返回
            if (status != behaviourTree.TaskStatus.Failure)
                return status;
            this._currentChildIndex++;
            // 如果子节点再最后一个，这意味着整个事情失败了
            if (this._currentChildIndex == this._children.length) {
                // 重置索引，否则下次运行时会崩溃
                this._currentChildIndex = 0;
                return behaviourTree.TaskStatus.Failure;
            }
            return behaviourTree.TaskStatus.Running;
        }
        handleConditionalAborts(context) {
            // 检查任何较低优先级的任务，看它们是否改变为成功
            if (this._hasLowerPriorityConditionalAbort)
                this.updateLowerPriorityAbortConditional(context, behaviourTree.TaskStatus.Failure);
            if (behaviourTree.AbortTypesExt.has(this.abortType, behaviourTree.AbortTypes.Self))
                this.updateSelfAbortConditional(context, behaviourTree.TaskStatus.Failure);
        }
    }
    behaviourTree.Selector = Selector;
})(behaviourTree || (behaviourTree = {}));
///<reference path="./Selector.ts"/>
var behaviourTree;
///<reference path="./Selector.ts"/>
(function (behaviourTree) {
    /**
     * 与选择器相同，但它会在启动时无序处理子项
     */
    class RandomSelector extends behaviourTree.Selector {
        onStart() {
            behaviourTree.ArrayExt.shuffle(this._children);
        }
    }
    behaviourTree.RandomSelector = RandomSelector;
})(behaviourTree || (behaviourTree = {}));
var behaviourTree;
(function (behaviourTree) {
    /**
     * 序列任务类似于一个 "和 "的操作。只要它的一个子任务返回失败，它就会返回失败。
     * 如果一个子任务返回成功，那么它将依次运行下一个任务。
     * 如果所有子任务都返回成功，那么它将返回成功。
     */
    class Sequence extends behaviourTree.Composite {
        constructor(abortType = behaviourTree.AbortTypes.None) {
            super();
            this.abortType = abortType;
        }
        update(context) {
            // 首先，如果我们还没有在第一个子节点身上，我们将处理有条件的中止
            if (this._currentChildIndex != 0) {
                this.handleConditionalAborts(context);
            }
            let current = this._children[this._currentChildIndex];
            let status = current.tick(context);
            // 如果子节点失败或仍在运行，提前返回
            if (status != behaviourTree.TaskStatus.Success)
                return status;
            this._currentChildIndex++;
            // 如果到子节点最后一个，整个序列就成功了
            if (this._currentChildIndex == this._children.length) {
                // 为下一次运行重置索引
                this._currentChildIndex = 0;
                return behaviourTree.TaskStatus.Success;
            }
            return behaviourTree.TaskStatus.Running;
        }
        handleConditionalAborts(context) {
            if (this._hasLowerPriorityConditionalAbort)
                this.updateLowerPriorityAbortConditional(context, behaviourTree.TaskStatus.Success);
            if (behaviourTree.AbortTypesExt.has(this.abortType, behaviourTree.AbortTypes.Self))
                this.updateSelfAbortConditional(context, behaviourTree.TaskStatus.Success);
        }
    }
    behaviourTree.Sequence = Sequence;
})(behaviourTree || (behaviourTree = {}));
///<reference path="./Sequence.ts"/>
var behaviourTree;
///<reference path="./Sequence.ts"/>
(function (behaviourTree) {
    /**
     * 与sequence相同，只是它在开始时对子级进行无序处理
     */
    class RandomSequence extends behaviourTree.Sequence {
        onStart() {
            behaviourTree.ArrayExt.shuffle(this._children);
        }
    }
    behaviourTree.RandomSequence = RandomSequence;
})(behaviourTree || (behaviourTree = {}));
var behaviourTree;
(function (behaviourTree) {
    /**
     * 包装一个ExecuteAction，这样它就可以作为一个ConditionalAction使用
     */
    class ExecuteActionConditional extends behaviourTree.ExecuteAction {
        constructor(action) {
            super(action);
            this.discriminator = "IConditional";
        }
    }
    behaviourTree.ExecuteActionConditional = ExecuteActionConditional;
})(behaviourTree || (behaviourTree = {}));
var behaviourTree;
(function (behaviourTree) {
    function isIConditional(obj) {
        return obj.discriminator === 'IConditional';
    }
    behaviourTree.isIConditional = isIConditional;
})(behaviourTree || (behaviourTree = {}));
var behaviourTree;
(function (behaviourTree) {
    /**
     * 当随机概率高于successProbability概率时返回成功。
     * 否则它将返回失败。
     * successProbability应该在0和1之间
     */
    class RandomProbability extends behaviourTree.Behavior {
        constructor(successProbability) {
            super();
            this.discriminator = "IConditional";
            this._successProbability = successProbability;
        }
        update(context) {
            if (Math.random() > this._successProbability)
                return behaviourTree.TaskStatus.Success;
            return behaviourTree.TaskStatus.Failure;
        }
    }
    behaviourTree.RandomProbability = RandomProbability;
})(behaviourTree || (behaviourTree = {}));
var behaviourTree;
(function (behaviourTree) {
    class Decorator extends behaviourTree.Behavior {
        invalidate() {
            super.invalidate();
            this.child.invalidate();
        }
    }
    behaviourTree.Decorator = Decorator;
})(behaviourTree || (behaviourTree = {}));
///<reference path="./Decorator.ts"/>
var behaviourTree;
///<reference path="./Decorator.ts"/>
(function (behaviourTree) {
    /**
     * 将总是返回失败，除了当子任务正在运行时
     */
    class AlwaysFail extends behaviourTree.Decorator {
        update(context) {
            behaviourTree.Assert.isNotNull(this.child, "child必须不能为空");
            let status = this.child.update(context);
            if (status == behaviourTree.TaskStatus.Running)
                return behaviourTree.TaskStatus.Running;
            return behaviourTree.TaskStatus.Failure;
        }
    }
    behaviourTree.AlwaysFail = AlwaysFail;
})(behaviourTree || (behaviourTree = {}));
///<reference path="./Decorator.ts"/>
var behaviourTree;
///<reference path="./Decorator.ts"/>
(function (behaviourTree) {
    /**
     *  将总是返回成功，除了当子任务正在运行时
     */
    class AlwaysSucceed extends behaviourTree.Decorator {
        update(context) {
            behaviourTree.Assert.isNotNull(this.child, "child必须不能为空");
            let status = this.child.update(context);
            if (status == behaviourTree.TaskStatus.Running)
                return behaviourTree.TaskStatus.Running;
            return behaviourTree.TaskStatus.Success;
        }
    }
    behaviourTree.AlwaysSucceed = AlwaysSucceed;
})(behaviourTree || (behaviourTree = {}));
///<reference path="./Decorator.ts"/>
var behaviourTree;
///<reference path="./Decorator.ts"/>
(function (behaviourTree) {
    /**
     * 装饰器，只有在满足条件的情况下才会运行其子程序。
     * 默认情况下，该条件将在每一次执行中被重新评估
     */
    class ConditionalDecorator extends behaviourTree.Decorator {
        constructor(conditional, shouldReevalute = true) {
            super();
            this.discriminator = "IConditional";
            this._conditionalStatus = behaviourTree.TaskStatus.Invalid;
            behaviourTree.Assert.isTrue(behaviourTree.isIConditional(conditional), "conditional 必须继承 IConditional");
            this._conditional = conditional;
            this._shouldReevaluate = shouldReevalute;
        }
        invalidate() {
            super.invalidate();
            this._conditionalStatus = behaviourTree.TaskStatus.Invalid;
        }
        onStart() {
            this._conditionalStatus = behaviourTree.TaskStatus.Invalid;
        }
        update(context) {
            behaviourTree.Assert.isNotNull(this.child, "child不能为空");
            this._conditionalStatus = this.executeConditional(context);
            if (this._conditionalStatus == behaviourTree.TaskStatus.Success)
                return this.child.tick(context);
            return behaviourTree.TaskStatus.Failure;
        }
        /**
         * 在shouldReevaluate标志之后执行条件，或者用一个选项来强制更新。
         * 终止将强制更新，以确保他们在条件变化时得到适当的数据。
         */
        executeConditional(context, forceUpdate = false) {
            if (forceUpdate || this._shouldReevaluate || this._conditionalStatus == behaviourTree.TaskStatus.Invalid)
                this._conditionalStatus = this._conditional.update(context);
            return this._conditionalStatus;
        }
    }
    behaviourTree.ConditionalDecorator = ConditionalDecorator;
})(behaviourTree || (behaviourTree = {}));
var behaviourTree;
(function (behaviourTree) {
    /**
     * 反转结果的子节点
     */
    class Inverter extends behaviourTree.Decorator {
        update(context) {
            behaviourTree.Assert.isNotNull(this.child, "child必须不能为空");
            let status = this.child.tick(context);
            if (status == behaviourTree.TaskStatus.Success)
                return behaviourTree.TaskStatus.Failure;
            if (status == behaviourTree.TaskStatus.Failure)
                return behaviourTree.TaskStatus.Success;
            return behaviourTree.TaskStatus.Running;
        }
    }
    behaviourTree.Inverter = Inverter;
})(behaviourTree || (behaviourTree = {}));
var behaviourTree;
(function (behaviourTree) {
    /**
     * 将重复执行其子任务，直到子任务被运行了指定的次数。
     * 即使子任务返回失败，它也可以选择继续执行子任务
     */
    class Repeater extends behaviourTree.Decorator {
        constructor(count, endOnFailure = false) {
            super();
            /** 是否永远重复 */
            this.repeatForever = false;
            this._iterationCount = 0;
            this.count = count;
            this.endOnFailure = endOnFailure;
        }
        onStart() {
            this._iterationCount = 0;
        }
        update(context) {
            behaviourTree.Assert.isNotNull(this.child, "child必须不能为空");
            // 我们在这里和运行后检查，以防计数为0
            if (!this.repeatForever && this._iterationCount == this.count)
                return behaviourTree.TaskStatus.Success;
            let status = this.child.tick(context);
            this._iterationCount++;
            if (this.endOnFailure && status == behaviourTree.TaskStatus.Failure)
                return behaviourTree.TaskStatus.Success;
            if (!this.repeatForever && this._iterationCount == this.count)
                return behaviourTree.TaskStatus.Success;
            return behaviourTree.TaskStatus.Running;
        }
    }
    behaviourTree.Repeater = Repeater;
})(behaviourTree || (behaviourTree = {}));
var behaviourTree;
(function (behaviourTree) {
    /**
     * 将继续执行其子任务，直到子任务返回失败
     */
    class UntilFail extends behaviourTree.Decorator {
        update(context) {
            behaviourTree.Assert.isNotNull(this.child, "child必须不为空");
            let status = this.child.update(context);
            if (status != behaviourTree.TaskStatus.Failure)
                return behaviourTree.TaskStatus.Running;
            return behaviourTree.TaskStatus.Success;
        }
    }
    behaviourTree.UntilFail = UntilFail;
})(behaviourTree || (behaviourTree = {}));
var behaviourTree;
(function (behaviourTree) {
    /**
     * 将继续执行其子任务，直到子任务返回成功
     */
    class UntilSuccess extends behaviourTree.Decorator {
        update(context) {
            behaviourTree.Assert.isNotNull(this.child, "child必须不为空");
            let status = this.child.update(context);
            if (status != behaviourTree.TaskStatus.Success)
                return behaviourTree.TaskStatus.Running;
            return behaviourTree.TaskStatus.Success;
        }
    }
    behaviourTree.UntilSuccess = UntilSuccess;
})(behaviourTree || (behaviourTree = {}));
var behaviourTree;
(function (behaviourTree) {
    /**
     * 数组扩展器
     * 模拟 Stack<T>.
     */
    class ArrayExt {
        /**
         * 将数组打乱顺序
         */
        static shuffle(list) {
            let n = list.length - 1;
            while (n > 1) {
                n--;
                let k = behaviourTree.Random.range(0, n + 1);
                let value = list[k];
                list[k] = list[n];
                list[n] = value;
            }
        }
        /**
         * 取出数组第一个项
         */
        static peek(list) {
            return list[0];
        }
        /**
         * 向数组头部添加一个项
         */
        static push(list, item) {
            list.splice(0, 0, item);
        }
        /**
         * 移除数组第一个项并返回它
         */
        static pop(list) {
            return list.shift();
        }
    }
    behaviourTree.ArrayExt = ArrayExt;
})(behaviourTree || (behaviourTree = {}));
var behaviourTree;
(function (behaviourTree) {
    class Assert {
        static fail(message, ...args) {
            if (message)
                console.assert(false, message, args);
            else
                console.assert(false);
        }
        static isTrue(condition, message, ...args) {
            if (!condition) {
                if (message)
                    Assert.fail(message, args);
                else
                    Assert.fail();
            }
        }
        static isNotNull(obj, message, ...args) {
            Assert.isTrue(obj != null, message, args);
        }
        static isFalse(condition, message, ...args) {
            if (message)
                this.isTrue(!condition, message, args);
            else
                this.isTrue(!condition);
        }
    }
    behaviourTree.Assert = Assert;
})(behaviourTree || (behaviourTree = {}));
var behaviourTree;
(function (behaviourTree) {
    class Random {
        static range(min, max) {
            let seed = new Date().getTime();
            max = max || 1;
            min = min || 0;
            seed = (seed * 9301 + 49297) % 233280;
            let rnd = seed / 233280.0;
            return min + rnd * (max - min);
        }
    }
    behaviourTree.Random = Random;
})(behaviourTree || (behaviourTree = {}));
var fsm;
(function (fsm) {
    class StateMethodCache {
    }
    class SimpleStateMachine extends es.Component {
        get currentState() {
            return this._currentState;
        }
        set currentState(value) {
            if (this._currentState == value)
                return;
            this.previousState = this._currentState;
            this._currentState = value;
            if (this._stateMethods.exitState != null)
                this._stateMethods.exitState.call(this);
            this.elapsedTimeInState = 0;
            this._stateMethods = this._stateCache.get(this._currentState);
            if (this._stateMethods.enterState != null)
                this._stateMethods.enterState.call(this);
        }
        set initialState(value) {
            this._currentState = value;
            this._stateMethods = this._stateCache.get(this._currentState);
            if (this._stateMethods.enterState != null)
                this._stateMethods.enterState.call(this);
        }
        constructor(stateType) {
            super();
            this.elapsedTimeInState = 0;
            this._stateCache = new Map();
            for (let enumValues in stateType) {
                this.configureAndCacheState(stateType, stateType[enumValues]);
            }
        }
        configureAndCacheState(stateType, stateEnum) {
            let stateName = stateType[stateEnum];
            let state = new StateMethodCache();
            state.enterState = this[stateName + "_enter"];
            state.tick = this[stateName + "_tick"];
            state.exitState = this[stateName + "_exit"];
            this._stateCache.set(stateEnum, state);
        }
        update() {
            this.elapsedTimeInState += es.Time.deltaTime;
            if (this._stateMethods.tick != null)
                this._stateMethods.tick.call(this);
        }
    }
    fsm.SimpleStateMachine = SimpleStateMachine;
})(fsm || (fsm = {}));
var fsm;
(function (fsm) {
    class State {
        setMachineAndContext(machine, context) {
            this._machine = machine;
            this._context = context;
            this.onInitialized();
        }
        /**
         * 在设置machine和context之后直接调用，允许状态执行任何所需的设置
         *
         * @memberof State
         */
        onInitialized() { }
        /**
         * 当状态变为活动状态时调用
         *
         * @memberof State
         */
        begin() { }
        /**
         * 在更新之前调用，允许状态最后一次机会改变状态
         *
         * @memberof State
         */
        reason() { }
        /**
         * 此状态不再是活动状态时调用
         *
         * @memberof State
         */
        end() { }
    }
    fsm.State = State;
})(fsm || (fsm = {}));
var fsm;
(function (fsm) {
    class StateMachine {
        get currentState() {
            return this._currentState;
        }
        constructor(context, initialState) {
            this.elapsedTimeInState = 0;
            this._states = new Map();
            this._context = context;
            this.addState(initialState);
            this._currentState = initialState;
            this._currentState.begin();
        }
        /**
         * 将状态添加到状态机
         * @param stateType
         * @param state
         */
        addState(state) {
            state.setMachineAndContext(this, this._context);
            this._states.set(es.TypeUtils.getType(state), state);
        }
        /**
         * 使用提供的增量时间为状态机计时
         * @param deltaTime
         */
        update(deltaTime) {
            this.elapsedTimeInState += deltaTime;
            this._currentState.reason();
            this._currentState.update(deltaTime);
        }
        /**
         * 从机器获取特定状态，而不必对其进行更改。
         * @param type
         */
        getState(type) {
            if (!this._states.has(type)) {
                console.error(`状态${type}不存在。你是不是在调用addState的时候忘记添加了?`);
                return null;
            }
            return this._states.get(type);
        }
        /**
         * 更改当前状态
         * @param newType
         */
        changeState(newType) {
            if (this._currentState instanceof newType) {
                return this._currentState;
            }
            if (this.currentState) {
                this._currentState.end();
            }
            if (!this._states.has(newType)) {
                console.error(`状态${newType}不存在。你是不是在调用addState的时候忘记添加了?`);
                return null;
            }
            this.elapsedTimeInState = 0;
            this.previousState = this._currentState;
            let newState = this._states.get(newType);
            if (newState)
                this._currentState = newState;
            this._currentState.begin();
            if (this.onStateChanged != null)
                this.onStateChanged();
            return this._currentState;
        }
    }
    fsm.StateMachine = StateMachine;
})(fsm || (fsm = {}));
var utilityAI;
(function (utilityAI) {
    class UtilityAI {
        constructor(context, rootSelector, updatePeriod = 0.2) {
            this._rootReasoner = rootSelector;
            this._context = context;
            this.updatePeriod = this._elapsedTime = updatePeriod;
        }
        tick() {
            this._elapsedTime -= es.Time.deltaTime;
            while (this._elapsedTime <= 0) {
                this._elapsedTime += this.updatePeriod;
                let action = this._rootReasoner.select(this._context);
                if (action != null)
                    action.execute(this._context);
            }
        }
    }
    utilityAI.UtilityAI = UtilityAI;
})(utilityAI || (utilityAI = {}));
var utilityAI;
(function (utilityAI) {
    /**
     * 包装Action以用作IAction而无需创建新类
     */
    class ActionExecutor {
        constructor(action) {
            this._action = action;
        }
        execute(context) {
            this._action(context);
        }
    }
    utilityAI.ActionExecutor = ActionExecutor;
})(utilityAI || (utilityAI = {}));
var utilityAI;
(function (utilityAI) {
    /**
     * 包含选项列表的操作。
     * 这些选项将传递给Appraisals，从而对最佳选项进行评分并找到最佳选择。
     */
    class ActionWithOptions {
        constructor() {
            this._appraisals = new Array();
        }
        getBestOption(context, options) {
            let result = null;
            // 表示单精度最小可能值
            let bestScore = -3.402823E+38;
            for (let i = 0; i < options.length; i++) {
                let option = options[i];
                let current = 0;
                for (let j = 0; j < this._appraisals.length; j++) {
                    current += this._appraisals[j].getScore(context, option);
                }
                if (current > bestScore) {
                    bestScore = current;
                    result = option;
                }
            }
            return result;
        }
        addScorer(scorer) {
            this._appraisals.push(scorer);
            return this;
        }
    }
    utilityAI.ActionWithOptions = ActionWithOptions;
})(utilityAI || (utilityAI = {}));
var utilityAI;
(function (utilityAI) {
    /**
     * 包含将按顺序执行的动作列表的动作
     */
    class CompositeAction {
        constructor() {
            this._actions = new Array();
        }
        execute(context) {
            for (let i = 0; i < this._actions.length; i++) {
                this._actions[i].execute(context);
            }
        }
        addAction(action) {
            this._actions.push(action);
            return this;
        }
    }
    utilityAI.CompositeAction = CompositeAction;
})(utilityAI || (utilityAI = {}));
var utilityAI;
(function (utilityAI) {
    class LogAction {
        constructor(text) {
            this._text = text;
        }
        execute(context) {
            console.log(this._text);
        }
    }
    utilityAI.LogAction = LogAction;
})(utilityAI || (utilityAI = {}));
var utilityAI;
(function (utilityAI) {
    /**
     * 调用另一个Reasoner的操作
     */
    class ReasonerAction {
        constructor(reasoner) {
            this._reasoner = reasoner;
        }
        execute(context) {
            let action = this._reasoner.select(context);
            if (action != null)
                action.execute(context);
        }
    }
    utilityAI.ReasonerAction = ReasonerAction;
})(utilityAI || (utilityAI = {}));
var utilityAI;
(function (utilityAI) {
    /**
     * 只有当所有的子项得分高于阈值的分数
     */
    class AllOrNothingConsideration {
        constructor(threshold = 0) {
            this._appraisals = new Array();
            this.threshold = threshold;
        }
        addAppraisal(appraisal) {
            this._appraisals.push(appraisal);
            return this;
        }
        getScore(context) {
            let sum = 0;
            for (let i = 0; i < this._appraisals.length; i++) {
                let score = this._appraisals[i].getScore(context);
                if (score < this.threshold)
                    return 0;
                sum += score;
            }
            return sum;
        }
    }
    utilityAI.AllOrNothingConsideration = AllOrNothingConsideration;
})(utilityAI || (utilityAI = {}));
var utilityAI;
(function (utilityAI) {
    /**
     * 总是返回一个固定的分数。 作为默认考虑，提供双重任务。
     */
    class FixedScoreConsideration {
        constructor(score = 1) {
            this.score = score;
        }
        getScore(context) {
            return this.score;
        }
    }
    utilityAI.FixedScoreConsideration = FixedScoreConsideration;
})(utilityAI || (utilityAI = {}));
var utilityAI;
(function (utilityAI) {
    /**
     * 通过总结所有子项评估的分数得分
     */
    class SumOfChildrenConsideration {
        constructor() {
            this._appraisals = new Array();
        }
        getScore(context) {
            let score = 0;
            for (let i = 0; i < this._appraisals.length; i++) {
                score += this._appraisals[i].getScore(context);
            }
            return score;
        }
    }
    utilityAI.SumOfChildrenConsideration = SumOfChildrenConsideration;
})(utilityAI || (utilityAI = {}));
var utilityAI;
(function (utilityAI) {
    /**
     * 通过总结子项评估得分，直到子项得分低于阈值
     */
    class ThresholdConsideration {
        constructor(threshold) {
            this._appraisals = new Array();
            this.threshold = threshold;
        }
        getScore(context) {
            let sum = 0;
            for (let i = 0; i < this._appraisals.length; i++) {
                let score = this._appraisals[i].getScore(context);
                if (score < this.threshold)
                    return sum;
                sum += score;
            }
            return sum;
        }
    }
    utilityAI.ThresholdConsideration = ThresholdConsideration;
})(utilityAI || (utilityAI = {}));
var utilityAI;
(function (utilityAI) {
    /**
     * 包装Func以用作评估而无需创建子类
     */
    class ActionAppraisal {
        constructor(appraisalAction) {
            this._appraisalAction = appraisalAction;
        }
        getScore(context) {
            return this._appraisalAction(context);
        }
    }
    utilityAI.ActionAppraisal = ActionAppraisal;
})(utilityAI || (utilityAI = {}));
var utilityAI;
(function (utilityAI) {
    /**
     * UtilityAI的根节点
     */
    class Reasoner {
        constructor() {
            this.defaultConsideration = new utilityAI.FixedScoreConsideration();
            this._condiderations = new Array();
        }
        select(context) {
            let consideration = this.selectBestConsideration(context);
            if (consideration != null)
                return consideration.action;
            return null;
        }
        addConsideration(consideration) {
            this._condiderations.push(consideration);
            return this;
        }
        setDefaultConsideration(defaultConsideration) {
            this.defaultConsideration = defaultConsideration;
            return this;
        }
    }
    utilityAI.Reasoner = Reasoner;
})(utilityAI || (utilityAI = {}));
///<reference path="./Reasoner.ts"/>
var utilityAI;
///<reference path="./Reasoner.ts"/>
(function (utilityAI) {
    /**
     * 选择高于默认考虑分数的第一个考虑因素
     */
    class FirstScoreReasoner extends utilityAI.Reasoner {
        selectBestConsideration(context) {
            let defaultScore = this.defaultConsideration.getScore(context);
            for (let i = 0; i < this._condiderations.length; i++) {
                if (this._condiderations[i].getScore(context) >= defaultScore)
                    return this._condiderations[i];
            }
            return this.defaultConsideration;
        }
    }
    utilityAI.FirstScoreReasoner = FirstScoreReasoner;
})(utilityAI || (utilityAI = {}));
///<reference path="./Reasoner.ts"/>
var utilityAI;
///<reference path="./Reasoner.ts"/>
(function (utilityAI) {
    /**
     * 选择评分最高的考虑因素
     */
    class HighestScoreReasoner extends utilityAI.Reasoner {
        selectBestConsideration(context) {
            let highsetScore = this.defaultConsideration.getScore(context);
            let consideration = null;
            for (let i = 0; i < this._condiderations.length; i++) {
                let score = this._condiderations[i].getScore(context);
                if (score > highsetScore) {
                    highsetScore = score;
                    consideration = this._condiderations[i];
                }
            }
            if (consideration == null)
                return this.defaultConsideration;
            return consideration;
        }
    }
    utilityAI.HighestScoreReasoner = HighestScoreReasoner;
})(utilityAI || (utilityAI = {}));
