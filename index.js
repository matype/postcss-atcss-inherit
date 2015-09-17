var annotation = require('css-annotation')

module.exports = function plugin (options) {

    options = options || {}

    return function (root) {
        css = options.css !== undefined ? options.css : root;
        removeCheck = options.removeBase !== undefined ? options.removeBase : true;

        var annotations = annotation.parse(css)

        var matchedRules = []
        root.walkRules(function (node) {
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
                            root.walkRules(function (rule) {
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

        var includeTmp = []
        matchedRules.forEach(function (matchedRule) {
            if (matchedRule.include) {
                // include
                root.walkRules(function (rule) {
                    rule.raws.semicolon = true
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
                                    if (tmp.selector === matchedRule.base && matchedRule.use === rule.selector) {
                                        tmp.decls.forEach(function (decl) {
                                            rule.append({
                                                prop: decl.prop,
                                                value: decl.value
                                            })
                                        })
                                        if (removeCheck) removeBase(root)
                                    }
                                })
                            }
                        })
                    }
                    else {
                        if (checkUse(rule)) {
                            includeTmp.forEach(function (tmp) {
                                if (tmp.selector === matchedRule.base && matchedRule.use === rule.selector) {
                                    tmp.decls.forEach(function (decl) {
                                        rule.append({
                                            prop: decl.prop,
                                            value: decl.value
                                        })
                                    })
                                    if (removeCheck) removeBase(root)
                                }
                            })
                        }
                    }
                })

            }
            else {
                // extend
                root.walkRules(function (rule) {
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
        if (rule.type === 'rule' && checkBase(rule) && !rule.change) {
            rule.remove()
        }
        if (rule.type === 'atrule') {
            rule.each(function (node) {
                if (node.type === 'rule' && checkBase(node)) {
                    node.remove()
                }
            })
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
    root.walkRules(function (rule) {
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
    root.walkRules(function (rule) {
        if (checkUse(rule)) {
            includeRules.push(rule)
        }
    })
    return includeRules
}
