// 1. 一个普通数据源
const data = {
  text: 'hello',
  foo: 1,
  bar: 2
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
function effect(fn, options = {}){
  const effectFn = () => {
    // 每次执行前清除依赖
    cleanup(effectFn)
    activeEffect = effectFn

    // 执行副作用之前入栈
    effectsStack.push(effectFn)

    const res = fn()

    // 执行副作用函数之后出栈，并把activeEffect还原
    effectsStack.pop()
    activeEffect = effectsStack[effectsStack.length - 1]

    return res
  }

  // 【解决 step1】副作用函数挂载options
  effectFn.options = options

  // 记录副作用函数被那些依赖收集
  effectFn.deps = []

  if(!options.lazy){
    effectFn()
  }
  return effectFn
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
    // 如果触发的依赖与正在执行的副作用函数相同，则不触发执行
    if(effectFn !== activeEffect){
      effectsRoRun.add(effectFn)
    }
  })
  effectsRoRun && effectsRoRun.forEach( effectFn => {
    // 如果副作用函数有配置scheduler，则调用该调度器
    if(effectFn.options.scheduler){
      effectFn.options.scheduler(effectFn)
    }else{
      effectFn()
    }
  })
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


// 7.1 计算属性
function computed(getter) {
  // 缓存
  let value
  // 脏读标志
  let dirty = true

  // 把getter当做副作用函数
  const effectFn = effect(getter, {
    lazy: true,
    scheduler(){
      // 在调度器中将”脏“标志置true；因为只要调度器函数执行，说明副作用函数依赖的数据发生了变化！！！
      if(!dirty){
        dirty = true
        trigger(obj, 'value')
      }
    }
  })

  const obj = {
    // 当读取value值时执行依赖
    get value() {
      // 数据“脏”时才计算，计算后缓存到value，然后标志取反
      if(dirty){
        value = effectFn()
        dirty = false
      }
      track(obj, 'value')
      return value
    }
  }
  return obj
}

// 7.2 使用计算属性
// const sumRes = computed(() => obj.foo + obj.bar)
// console.log(sumRes.value)
// console.log(sumRes.value)

// obj.foo++
// console.log(sumRes.value)

// 7.3 嵌套使用计算属性
// const sumRes = computed(() => obj.foo + obj.bar)

// effect(() => {
//   console.log('sumRes.value:', sumRes.value)
// })
// obj.foo++

// 8.1 watch侦听实现原理
function watch(source, cb){

  let getter
  if(typeof source === 'function'){
    getter = source
  }else{
    getter = () => traverse(source)
  }

  let newValue, oldValue

  const effectFn = effect(() => getter(), {
    lazy: true,
    scheduler(){
      newValue = effectFn()

      cb(newValue, oldValue)

      oldValue = newValue
    }
  })

  oldValue = effectFn()
}

function traverse(source, seen = new Set()) {
  if(typeof source !== 'object' || source === null || seen.has(source)) return
  for(let k in source){
    traverse(source[k], seen)
  }
  return source
}

// 8.2 使用watch
watch(() => obj.foo, (newValue, oldValue) => {
  console.log('newValue:', newValue, 'oldValue:', oldValue)
})
obj.foo++