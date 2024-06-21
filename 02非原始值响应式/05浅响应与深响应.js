// 3.1 一个收集依赖的数据结构（桶）
const bucket = new WeakMap()

// 3.1.1 一个symbol，记录for...in操作
const ITERATE_KEY = Symbol()

// 3.2 响应式核心
function createReactive(obj, isShallow = false) {
  return new Proxy(obj, {
    get(target, key, receiver){
      // 访问代理对象 raw 属性，则返回原对象
      if(key === 'raw') return target

      if(!activeEffect) return Reflect.get(target, key, receiver)

      track(target, key)

      const res = Reflect.get(target, key, receiver)

      if(isShallow) return res

      if(typeof res === 'object' && res !== null){
        return reactive(res)
      }

      return res
    },

    set(target, key, newValue, receiver){
      // 获取旧值
      const oldValue = target[key]

      const type = Object.prototype.hasOwnProperty(target, key) ? 'SET' : 'ADD'
      const res = Reflect.set(target, key, newValue, receiver)

      // 解决原型链属性多次触发副作用函数问题
      if(receiver.raw === target){
        if(newValue !== oldValue && ( newValue === newValue || oldValue === oldValue )){
          trigger(target, key, type)
        }
      }

      return res
    },

    // 拦截 in 操作符
    has(target, key){
      track(target, key)

      return Reflect.has(target, key)
    },

    // 拦截 for...in 操作
    ownKeys(target){
      track(target, ITERATE_KEY)

      return Reflect.ownKeys(target)
    },

    // 拦截 delete 操作
    deleteProperty(target, key){
      const hadKey = Object.prototype.hasOwnProperty.call(target, key)
      const res = Reflect.deleteProperty(target, key)

      if(res && hadKey){
        trigger(target, key, 'DELETE')
      }

      return res
    }
  })
}

function reactive(obj){
  return createReactive(obj)
}

function shallowReactive(obj){
  return createReactive(obj, true)
}

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

  // 副作用函数挂载options
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
function trigger(target, key, type) {
  const depsMap = bucket.get(target)
  if(!depsMap) return

  const effects = depsMap.get(key) || []
  const iterateEffects = depsMap.get(ITERATE_KEY) || []
  
  const effectsRoRun = new Set()
  effects.forEach(effectFn => {
    // 如果触发的依赖与正在执行的副作用函数相同，则不触发执行
    if(effectFn !== activeEffect){
      effectsRoRun.add(effectFn)
    }
  })

  if(type === 'ADD' || type === 'DELETE'){
    // 将与 ITERATE_KEY 相关联的副作用函数也添加到 effectsToRun
    iterateEffects.forEach(effectFn => {
      if(effectFn !== activeEffect){
        effectsRoRun.add(effectFn)
      }
    })
  }

  effectsRoRun && effectsRoRun.forEach( effectFn => {
    // 如果副作用函数有配置scheduler，则调用该调度器
    if(effectFn.options.scheduler){
      effectFn.options.scheduler(effectFn)
    }else{
      effectFn()
    }
  })
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

const obj = reactive({ foo: { bar: 1 } })
effect(() => {
  console.log('obj.foo.bar:', obj.foo.bar)
})

console.log('修改 obj.foo.bar')
obj.foo.bar = 2
// obj.foo = {bar: 2}