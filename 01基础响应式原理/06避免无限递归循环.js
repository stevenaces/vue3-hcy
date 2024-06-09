// 1. 一个普通数据源
const data = {
  text: 'hello',
  foo: 1
}

// 2. 一个副作用函数
function work(){
  document.body.innerHTML = data.text
}

// 3.1 一个收集依赖的数据结构（桶）
const bucket = new WeakMap()

// 3.2 一个代理对象
const obj = new Proxy(data, {
  get(target, key){

    if(!activeEffect) return target[key]

    track(target, key)

    return target[key]
  },

  set(target, key, newValue){
    target[key] = newValue

    trigger(target, key)

    return true
  }
})

// 4.1 一个记录当前的执行的副作用函数，一个记录嵌套的副作用函数栈
let activeEffect
let effectsStack = []

// 4.2 一种收集依赖的机制
function effect(fn){
  const effectFn = () => {
    // 每次执行前清除依赖
    cleanup(effectFn)
    activeEffect = effectFn

    // 执行副作用之前入栈
    effectsStack.push(effectFn)

    fn()

    // 执行副作用函数之后出栈，并把activeEffect还原
    effectsStack.pop()
    activeEffect = effectsStack[effectsStack.length - 1]
  }

  // 记录副作用函数被那些依赖收集
  effectFn.deps = []

  effectFn()
}

// 5.1 依赖收集函数
function track(target, key) {
  let depsMap = bucket.get(target)
  if(!depsMap){
    bucket.set(target, (depsMap = new Map()))
  }

  let deps = depsMap.get(key)
  if(!deps){
    depsMap.set(key, (deps = new Set()))
  }

  deps.add(activeEffect)
}
// 5.1 触发依赖函数
function trigger(target, key) {
  const depsMap = bucket.get(target)
  if(!depsMap) return

  const effects = depsMap.get(key)
  
  const effectsRoRun = new Set()
  effects.forEach(effectFn => {
    // 【解决方法】如果触发的依赖与正在执行的副作用函数相同，则不触发执行
    if(effectFn !== activeEffect){
      effectsRoRun.add(effectFn)
    }
  })
  effectsRoRun && effectsRoRun.forEach( effectFn => effectFn())
  // effects && effects.forEach( effectFn => effectFn())
}

// 6.1 依赖清除函数
function cleanup(effectFn) {
  for (let i = 0; i < effectFn.deps.length; i++) {
    const deps = effectFn.deps[i];
    // 将effectFn从依赖集合中删除
    deps.delete(effectFn)
  }
  // 重置effectFn记录
  effectFn.deps.length = 0
}

// 可能引起无限递归的副作用函数
effect(() => obj.foo++)
