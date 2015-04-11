var annotation = require('css-annotation')

module.exports = function plugin (css, options) {
    options = options || {}

    var annotations = annotation.parse(css)

    return function (root) {
        var matchedRules = []

        root.eachRule(function (node) {
            if (checkUse(node)) {
                annotations.forEach(function (annotation) {
                    if (node.selector === annotation.rule) {
                        var res = {}
                        res.use = node.selector
                        if (!Array.isArray(annotation.use)) {
                            annotation.use = [annotation.use]
                        }
                        res.base = annotation.use
                        res.include = false
                        if (node.parent.type === "atrule") {
                            res.include = true
                        }
                        else {
                            var lengthMaps = []
                            root.eachRule(function (rule) {
                                var selLength = rule.selector.length
                                var declLength = 0
                                rule.nodes.forEach(function (decl) {
                                    if (decl.type !== "decl") {
                                        return
                                    }
                                    declLength += decl.toString().trim().length
                                })
                                lengthMaps.push({
                                    name: rule.selector,
                                    sel: selLength,
                                    decl: declLength
                                })
                            })
                            lengthMaps.forEach(function (map) {
                                res.base.forEach(function (b) {
                                    if (map.name === b) {
                                        if (res.use.length > map.decl) {
                                            res.include = true
                                        }
                                    }
                                })
                            })
                        }
                        matchedRules.push(res)
                    }
                })
            }
        })

        var tmpMatched = []
        var newMatched = []
        matchedRules.forEach(function (matchedRule) {
            matchedRule.base.forEach(function (base) {
                tmpMatched.push({
                    use: matchedRule.use,
                    base: base,
                    include: matchedRule.include
                })
            })
        })
        tmpMatched.forEach(function (tmp, i) {
            var tmpSelectors = []
            var count = true
            var isOne = true
            for (var j = i + 1; j < tmpMatched.length; j++) {
                if (tmp.base === tmpMatched[j].base) {
                    if (count) tmpSelectors.push(tmp.use)
                        tmpSelectors.push(tmpMatched[j].use)
                    count = false
                    isOne = false
                    tmpMatched.splice(j, 1)
                }
            }
            var newSelector  = tmpSelectors.join(',\n')
            if (newSelector) {
                newMatched.push({
                    use: newSelector,
                    base: tmp.base,
                    include: tmp.include
                })
            }
            if (isOne) {
                newMatched.push({
                    use: tmp.use,
                    base: tmp.base,
                    include: tmp.include
                })
            }
        })
        matchedRules = newMatched

        matchedRules.forEach(function (matchedRule) {
            if (matchedRule.include) {
                // include
                includeTmp = []
                root.eachRule(function (rule) {
                    if (checkBase(rule)) {
                        var decls = []
                        rule.nodes.forEach(function (child) {
                            if (child.type === 'decl') {
                                decls.push({
                                    prop: child.prop,
                                    value: child.value
                                })
                            }
                        })
                        includeTmp.push({
                            selector: rule.selector,
                            decls: decls
                        })
                    }
                })

                root.each(function (rule) {
                    if (rule.type === 'atrule') {
                        rule.nodes.forEach(function (rule) {
                            if (checkUse(rule)) {
                                includeTmp.forEach(function (tmp) {
                                    tmp.decls.forEach(function (decl) {
                                        rule.append({
                                            prop: decl.prop,
                                            value: decl.value
                                        })
                                    })
                                    removeBase(root)
                                })
                            }
                        })
                    }
                    else {
                        if (checkUse(rule)) {
                            includeTmp.forEach(function (tmp) {
                                tmp.decls.forEach(function (decl) {
                                    rule.append({
                                        prop: decl.prop,
                                        value: decl.value
                                    })
                                })
                                removeBase(root)
                            })
                        }
                    }
                })

            }
            else {
                // extend
                root.eachRule(function (rule) {
                    matchedRules.forEach(function (matchedRule) {
                        if (Array.isArray(matchedRule.base)) {
                            matchedRule.base.forEach(function (base) {
                                if (rule.selector === base) {
                                    rule.selector = matchedRule.use
                                    rule.change = true;
                                }
                            })
                        } else {
                            if (rule.selector === matchedRule.base) {
                                rule.selector = matchedRule.use
                                rule.change = true;
                            }
                        }
                    })
                })

            }
        })

        return root

    }
}


function removeBase (root) {
    root.each(function (rule) {
        if (checkBase(rule) && !rule.change) {
            rule.removeSelf()
        }
    })
}

function checkBase (node) {
    if (node.nodes) {
        var children = node.nodes
        var text = ''
        children.forEach(function (child) {
            if (child.type === 'comment') text = child.text
        })
        if (text.match(/\@base/)) return true
    }
    return false
}

function baseRules (root) {
    var baseRules = []
    root.eachRule(function (rule) {
        if (checkBase(rule)) {
            baseRules.push(rule)
        }
    })
    return baseRules
}

function checkUse (node) {
    if (node.nodes) {
        var children = node.nodes
        var text = ''
        children.forEach(function (child) {
            if (child.type === 'comment') text = child.text
        })
        if (text.match(/\@use/)) return true
    }
    return false
}

function includeRules (root) {
    var includeRules = []
    root.eachRule(function (rule) {
        if (checkUse(rule)) {
            includeRules.push(rule)
        }
    })
    return includeRules
}
